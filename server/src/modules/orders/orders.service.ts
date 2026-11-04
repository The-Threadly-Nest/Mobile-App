import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { OrdersInput } from "./orders.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { orderAccessWhere, bookingAccessWhere } from "../../lib/authorization";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

import { formatEstimatedReady } from "../../utils/dateUtils";
import { sendNotificationToAdmin, sendNotificationToUser } from "../../lib/notifications";
import { isUniqueConstraintError, readIdempotencyKey } from "../../lib/idempotency";
import { type CollectionPagination } from "../../schemas/pagination.schema";
import { collectionWindow, collectionPage } from "../../lib/pagination";

const STATUS_LABELS: Record<string, { title: string; body: string }> = {
  pending_admin_review: { title: "Order Received ✅", body: "Your order is under review by the fashion house." },
  measurements_confirmed: { title: "Measurements Confirmed 📏", body: "Your measurements have been confirmed. Production begins soon!" },
  fabric_sourced: { title: "Fabric Sourced 🧵", body: "The perfect fabric for your garment has been sourced." },
  in_production: { title: "In Production ✂️", body: "Your garment is now being crafted by our tailors." },
  quality_check: { title: "Quality Check 🔍", body: "Final quality checks are underway on your order." },
  ready_for_pickup: { title: "Ready for Pickup 🎉", body: "Your garment is ready! Come pick it up at your convenience." },
  ready: { title: "Ready for Pickup 🎉", body: "Your garment is ready! Come pick it up at your convenience." },
  completed: { title: "Order Completed 🌟", body: "Thank you! Your order has been marked as completed." },
  delivered: { title: "Order Delivered 📦", body: "Your garment has been delivered. Enjoy wearing it!" },
  cancelled: { title: "Order Cancelled", body: "Your order has been cancelled. Contact us if you have questions." },
};

function getProgressPercent(status: string): number {
  switch (status) {
    case "booked":
    case "order_placed":
    case "pending_admin_review":
      return 16;
    case "measurements_confirmed":
      return 35;
    case "fabric_sourced":
      return 50;
    case "in_production":
      return 70;
    case "quality_check":
      return 85;
    case "ready_for_pickup":
    case "ready":
    case "completed":
    case "delivered":
      return 100;
    default:
      return 25;
  }
}

function generateOrderNumberServer(idOrBookingId?: string): string {
  if (!idOrBookingId) return "#TFH-2000";
  if (idOrBookingId.startsWith("#TFH-")) return idOrBookingId;
  const cleanId = idOrBookingId.replace(/^esc-/, "");
  let hash = 0;
  for (let i = 0;i < cleanId.length;i++) {
    hash = (hash << 5) - hash + cleanId.charCodeAt(i);
    hash |= 0;
  }
  const num = 2000 + (Math.abs(hash) % 900);
  return `#TFH-${num}`;
}

function resolveGarmentImageUrl(garmentTitle?: string, fashionHouse?: any): string {
  const lowerTitle = (garmentTitle || "").toLowerCase();
  if (fashionHouse?.catalogItems && fashionHouse.catalogItems.length > 0) {
    const match = fashionHouse.catalogItems.find(
      (item: any) => lowerTitle.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(lowerTitle)
    );
    if (match?.imageUrl) return match.imageUrl;
    if (fashionHouse.catalogItems[0]?.imageUrl) return fashionHouse.catalogItems[0].imageUrl;
  }

  if (fashionHouse?.brandLogoUrl) return fashionHouse.brandLogoUrl;
  return "";
}

// GET /api/orders/my-orders — Customer list own bookings & orders

// POST /api/orders/catalog-checkout — customer purchases catalog items directly.

// Legacy clients created free-form bookings here without reserving a
// tenant-owned slot. Booking now requires selecting a fashion-house slot.

// GET /api/orders/track/:id — Customer or Staff fetch booking/order tracking details

// POST /api/orders/track/:id/cancel — Customer or Admin/Staff cancel booking/order

// Create Order (Admin / Staff)

// List Orders

// Get Single Order Details (Admin & Staff)

// Admin Assign Staff Member to Order

// Update Status

@Injectable()
export class OrdersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async getMyOrders(input: OrdersInput<"getMyOrders">) {

    const userId = input.authUserId!;
    const { page, limit } = input.query as unknown as CollectionPagination;
    const windowEnd = page * limit + 1;
    const [bookings, standaloneOrders] = await Promise.all([
      this.database.client.booking.findMany({
        where: { customerId: userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: windowEnd,
        include: {
          fashionHouse: {
            select: {
              id: true,
              shopName: true,
              catalogItems: {
                select: { id: true, name: true, imageUrl: true },
                orderBy: { createdAt: "desc" },
                take: 25,
              },
            },
          },
          order: { select: { id: true, status: true } },
        },
      }),
      this.database.client.order.findMany({
        where: { bookingId: null, customer: { userId } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: windowEnd,
        include: {
          fashionHouse: {
            select: {
              id: true,
              shopName: true,
              catalogItems: {
                select: { id: true, name: true, imageUrl: true },
                orderBy: { createdAt: "desc" },
                take: 25,
              },
            },
          },
        },
      }),
    ]);

    const formatted = bookings.map((b) => {
      const canonicalId = b.order?.id || b.id;
      const currentStatus = b.order?.status || b.status;

      let mappedStatus: "active" | "completed" | "declined" = "active";
      if (currentStatus === "completed" || currentStatus === "delivered") {
        mappedStatus = "completed";
      } else if (currentStatus === "declined" || currentStatus === "cancelled") {
        mappedStatus = "declined";
      }

      // Dynamically resolve real garment photo from fashion house catalog or garment type
      let realImage = "";
      const lowerNotes = (b.styleNotes || "").toLowerCase();
      if (b.fashionHouse?.catalogItems && b.fashionHouse.catalogItems.length > 0) {
        const match = b.fashionHouse.catalogItems.find(
          (item) => lowerNotes.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(lowerNotes)
        );
        if (match?.imageUrl) {
          realImage = match.imageUrl;
        } else {
          realImage = b.fashionHouse.catalogItems[0].imageUrl;
        }
      }

      return {
        _createdAt: b.createdAt,
        id: b.id,
        orderId: b.order?.id,
        bookingId: b.id,
        atelierName: b.fashionHouse?.shopName || "Fashion House",
        garmentType: b.styleNotes || "Bespoke Fitting",
        orderNumber: generateOrderNumberServer(canonicalId),
        estimatedReady: formatEstimatedReady(b.preferredTime, b.preferredDate),
        progressPercent: getProgressPercent(currentStatus),
        imageUrl: realImage,
        status: mappedStatus,
        rawStatus: currentStatus,
      };
    });

    const standaloneFormatted = standaloneOrders.map((order) => {
      let mappedStatus: "active" | "completed" | "declined" = "active";
      if (["completed", "delivered"].includes(order.status)) mappedStatus = "completed";
      if (["declined", "cancelled"].includes(order.status)) mappedStatus = "declined";
      return {
        _createdAt: order.createdAt,
        id: order.id,
        orderId: order.id,
        atelierName: order.fashionHouse.shopName || "Fashion House",
        garmentType: order.itemName,
        orderNumber: generateOrderNumberServer(order.id),
        estimatedReady: "Awaiting fashion house confirmation",
        progressPercent: getProgressPercent(order.status),
        imageUrl: resolveGarmentImageUrl(order.itemName, order.fashionHouse),
        status: mappedStatus,
        rawStatus: order.status,
      };
    });

    const offset = (page - 1) * limit;
    const combinedWindow = [...formatted, ...standaloneFormatted]
      .sort((a, b) => b._createdAt.getTime() - a._createdAt.getTime())
      .slice(offset, offset + limit + 1)
      .map(({ _createdAt, ...order }) => order);

    return collectionPage(combinedWindow, page, limit);

  }

  async postCatalogCheckout(input: OrdersInput<"postCatalogCheckout">) {

    const userId = input.authUserId!;
    const idempotencyKey = readIdempotencyKey(input.headers);
    if (!idempotencyKey) {
      return rejectRequest({ error: "We couldn't confirm this order request. Please refresh your cart and try again." }, 400);
    }

    const { fashionHouseId, items } = input.body as {
      fashionHouseId: string;
      items: Array<{ catalogItemId: string; quantity: number; selectedSize: string; selectedColor: string }>;
    };

    const priorOrder = await this.database.client.order.findFirst({
      where: { fashionHouseId, idempotencyKey, customer: { userId } },
      include: { fashionHouse: { select: { shopName: true } } },
    });
    if (priorOrder) return result(priorOrder, 200);

    const uniqueItemIds = [...new Set(items.map((item) => item.catalogItemId))];
    const [catalogItems, user, fashionHouse] = await Promise.all([
      this.database.client.catalogItem.findMany({
        where: { id: { in: uniqueItemIds }, fashionHouseId },
        select: { id: true, name: true, priceFrom: true },
      }),
      this.database.client.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      this.database.client.fashionHouse.findUnique({ where: { id: fashionHouseId }, select: { id: true, shopName: true } }),
    ]);

    if (!fashionHouse) return rejectRequest({ error: "Fashion house not found." }, 404);
    if (catalogItems.length !== uniqueItemIds.length) {
      return rejectRequest({ error: "One or more cart items are no longer available from this fashion house." }, 400);
    }

    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    let total = 0;
    const itemLabels: string[] = [];
    for (const requestedItem of items) {
      const catalogItem = catalogById.get(requestedItem.catalogItemId)!;
      if (!catalogItem.priceFrom || catalogItem.priceFrom <= 0) {
        return rejectRequest({ error: `${catalogItem.name} requires a price confirmation before ordering.` }, 400);
      }
      total += catalogItem.priceFrom * requestedItem.quantity;
      const options = [requestedItem.selectedSize, requestedItem.selectedColor].filter(Boolean).join(", ");
      itemLabels.push(`${requestedItem.quantity}× ${catalogItem.name}${options ? ` (${options})` : ""}`);
    }

    const order = await this.database.client.$transaction(async (tx) => {
      let customer = await tx.customer.findFirst({ where: { fashionHouseId, userId } });
      if (!customer) {
        customer = await tx.customer.create({
          data: {
            fashionHouseId,
            userId,
            name: user?.name || user?.email || "Customer",
            status: "active",
          },
        });
      }

      try {
        return await tx.order.create({
          data: {
            fashionHouseId,
            customerId: customer.id,
            itemName: itemLabels.join("; "),
            price: total,
            status: "order_placed",
            idempotencyKey,
          },
          include: { fashionHouse: { select: { shopName: true } } },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const existing = await tx.order.findFirst({
          where: { fashionHouseId, idempotencyKey, customer: { userId } },
          include: { fashionHouse: { select: { shopName: true } } },
        });
        if (!existing) throw error;
        return existing;
      }
    });

    void sendNotificationToAdmin(
      fashionHouseId,
      "New catalog order",
      `${user?.name || "A customer"} placed an order for ${items.length} cart item${items.length === 1 ? "" : "s"}.`,
      { screen: "orders", orderId: order.id },
    );

    return result(order, 201);

  }

  async postMyOrders(input: OrdersInput<"postMyOrders">) {
    return rejectRequest({
      code: "BOOKING_FLOW_UPDATED",
      error: "Please update the app and select an available fitting slot from the fashion house.",
    }, 410);
  }

  async getTrackById(input: OrdersInput<"getTrackById">) {

    const id = routeParam(input, "id");
    const userId = input.authUserId!;
    const isStaffOrAdmin = input.authRole === "admin" || input.authRole === "staff";

    // Fire both lookups in parallel — whichever resolves with a record wins
    const [booking, order] = await Promise.all([
      this.database.client.booking.findFirst({
        where: {
          id,
          ...bookingAccessWhere(input),
        },
        include: {
          fashionHouse: {
            select: {
              id: true,
              shopName: true,
              location: true,
              phone: true,
              brandLogoUrl: true,
              catalogItems: { select: { id: true, name: true, imageUrl: true } },
            },
          },
          order: {
            include: {
              staff: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      this.database.client.order.findFirst({
        where: { id, ...orderAccessWhere(input) },
        include: {
          fashionHouse: {
            select: {
              id: true,
              shopName: true,
              location: true,
              phone: true,
              brandLogoUrl: true,
              catalogItems: { select: { id: true, name: true, imageUrl: true } },
            },
          },
          customer: { select: { id: true, name: true, phone: true, userId: true } },
          staff: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    if (booking) {
      const currentStatus = (booking as any).order?.status || booking.status;
      const garmentType = (booking as any).order?.itemName || booking.styleNotes || "Bespoke Garment";
      const imageUrl = resolveGarmentImageUrl(garmentType, booking.fashionHouse);

      return {
        id: booking.id,
        orderId: (booking as any).order?.id,
        atelierName: booking.fashionHouse?.shopName || "Luxury Fashion House",
        fashionHouseId: booking.fashionHouseId,
        fashionHousePhone: booking.fashionHouse?.phone,
        fashionHouseLocation: booking.fashionHouse?.location,
        garmentType,
        status: currentStatus,
        progressPercent: getProgressPercent(currentStatus),
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        estimatedReady: formatEstimatedReady(booking.preferredTime, booking.preferredDate),
        price: (booking as any).order?.price,
        imageUrl,
        staff: (booking as any).order?.staff
          ? {
            name: (booking as any).order.staff.name,
            email: (booking as any).order.staff.email,
          }
          : null,
      };
    }

    if (order) {
      if (!isStaffOrAdmin && order.customer.userId !== userId) {
        return rejectRequest({ error: "You don't have permission to view this." }, 403);
      }

      const garmentType = order.itemName || "Bespoke Garment";
      const imageUrl = resolveGarmentImageUrl(garmentType, order.fashionHouse);

      return {
        id: order.id,
        orderId: order.id,
        atelierName: order.fashionHouse?.shopName || "Luxury Fashion House",
        fashionHouseId: order.fashionHouseId,
        fashionHousePhone: order.fashionHouse?.phone,
        fashionHouseLocation: order.fashionHouse?.location,
        garmentType,
        status: order.status,
        progressPercent: getProgressPercent(order.status),
        estimatedReady: "In Production",
        price: order.price,
        imageUrl,
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
        },
        staff: order.staff
          ? {
            name: order.staff.name,
            email: order.staff.email,
          }
          : null,
      };
    }

    return rejectRequest({ error: "Booking or order not found." }, 404);

  }

  async postTrackByIdCancel(input: OrdersInput<"postTrackByIdCancel">) {

    const id = routeParam(input, "id");
    const userId = input.authUserId!;
    const isStaffOrAdmin = input.authRole === "admin" || input.authRole === "staff";

    const [booking, order] = await Promise.all([
      this.database.client.booking.findFirst({
        where: {
          id,
          ...bookingAccessWhere(input),
        },
        include: { order: { select: { id: true } } },
      }),
      this.database.client.order.findFirst({
        where: { id, ...orderAccessWhere(input) },
        include: {
          customer: { select: { userId: true } },
          booking: { select: { id: true, availableSlotId: true } },
        },
      }),
    ]);

    if (!booking && !order) {
      return rejectRequest({ error: "Booking or order not found." }, 404);
    }

    if (order && !isStaffOrAdmin && order.customer.userId !== userId) {
      return rejectRequest({ error: "You don't have permission to view this." }, 403);
    }

    const currentStatus = order?.status || booking?.status || "booked";
    const nonCancellable = ["fabric_sourced", "in_production", "quality_check", "ready_for_pickup", "ready", "completed", "delivered"];
    if (nonCancellable.includes(currentStatus)) {
      return rejectRequest({
        error: "This order is already being made. Please contact the fashion house if you need to cancel.",
      }, 400);
    }

    await this.database.client.$transaction(async (tx) => {
      const bookingToCancel = booking ?? order?.booking;
      if (bookingToCancel) {
        await tx.booking.update({
          where: { id: bookingToCancel.id },
          data: { status: "cancelled", availableSlotId: null },
        });
        if (bookingToCancel.availableSlotId) {
          await tx.availableSlot.updateMany({
            where: {
              id: bookingToCancel.availableSlotId,
              fashionHouseId: booking?.fashionHouseId ?? order?.fashionHouseId,
              booked: true,
            },
            data: { booked: false },
          });
        }
      }
      if (order) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "cancelled" },
        });
      } else if (booking?.order) {
        await tx.order.update({
          where: { id: booking.order.id },
          data: { status: "cancelled" },
        });
      }
    });

    return { success: true, message: "Order cancelled successfully.", status: "cancelled" };

  }

  async post(input: OrdersInput<"post">) {

    const fhId = getOwnFashionHouseId(input);
    const idempotencyKey = readIdempotencyKey(input.headers);
    const { customerId, itemName, price, staffId } = input.body;

    if (!customerId || !itemName || !price) {
      return rejectRequest({ error: "Please select a customer and enter the item name and price." }, 400);
    }

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await this.database.client.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return rejectRequest({ error: "Customer not found in your fashion house." }, 404);
    }

    const assignedStaffId = staffId || (input.authRole === "staff" ? input.authUserId : null);

    if (assignedStaffId) {
      const staff = await this.database.client.user.findFirst({
        where: { id: assignedStaffId, fashionHouseId: fhId, role: "staff", active: true },
        select: { id: true },
      });
      if (!staff) return rejectRequest({ error: "Staff member not found." }, 404);
    }

    if (idempotencyKey) {
      const priorOrder = await this.database.client.order.findFirst({
        where: { fashionHouseId: fhId, idempotencyKey },
      });
      if (priorOrder) return result(priorOrder, 200);
    }

    let order;
    try {
      order = await this.database.client.order.create({
        data: {
          fashionHouseId: fhId,
          customerId,
          itemName,
          price,
          staffId: assignedStaffId,
          status: "order_placed",
          idempotencyKey,
        },
      });
    } catch (error) {
      if (!idempotencyKey || !isUniqueConstraintError(error)) throw error;
      const existing = await this.database.client.order.findFirst({ where: { fashionHouseId: fhId, idempotencyKey } });
      if (!existing) throw error;
      return result(existing, 200);
    }

    return result(order, 201);

  }

  async get(input: OrdersInput<"get">) {

    const fhId = getOwnFashionHouseId(input);
    const { page, limit } = input.query as unknown as CollectionPagination;
    const whereClause: any = { fashionHouseId: fhId };

    if (input.authRole === "staff") {
      whereClause.OR = [
        { staffId: input.authUserId },
        { staffId: null },
      ];
    }

    const orders = await this.database.client.order.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true, email: true } },
        invoice: {
          select: {
            id: true,
            total: true,
            currency: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
      },
    });

    return collectionPage(orders, page, limit);

  }

  async getById(input: OrdersInput<"getById">) {

    const fhId = getOwnFashionHouseId(input);
    const order = await this.database.client.order.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
      include: {
        customer: {
          include: {
            measurements: { orderBy: { recordedAt: "desc" } },
          },
        },
        staff: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return rejectRequest({ error: "Order not found." }, 404);
    }

    let measurements = order.customer.measurements || [];

    return {
      ...order,
      customer: {
        ...order.customer,
        measurements,
      },
    };

  }

  async patchByIdAssign(input: OrdersInput<"patchByIdAssign">) {

    const fhId = getOwnFashionHouseId(input);
    const { staffId } = input.body;

    const order = await this.database.client.order.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });
    if (!order) {
      return rejectRequest({ error: "Order not found." }, 404);
    }

    if (staffId) {
      const staffUser = await this.database.client.user.findFirst({
        where: { id: staffId, fashionHouseId: fhId, role: "staff" },
      });
      if (!staffUser) {
        return rejectRequest({ error: "Staff member not found in your fashion house." }, 404);
      }
    }

    const updated = await this.database.client.order.update({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
      data: { staffId: staffId || null },
      include: {
        staff: { select: { id: true, name: true, email: true } },
      },
    });

    return updated;

  }

  async patchByIdStatus(input: OrdersInput<"patchByIdStatus">) {

    const fhId = getOwnFashionHouseId(input);
    const { status } = input.body;

    // Tenant Isolation: Verify order belongs to this tenant — also pull customer & fashion house for notification
    const order = await this.database.client.order.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
      include: {
        customer: { select: { userId: true, name: true } },
        fashionHouse: { select: { shopName: true } },
      },
    });
    if (!order) {
      return rejectRequest({ error: "Order not found." }, 404);
    }

    const updated = await this.database.client.order.update({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
      data: { status },
    });

    if (order.bookingId) {
      await this.database.client.booking.update({
        where: { id: order.bookingId, fashionHouseId: fhId },
        data: { status },
      }).catch(() => { });
    }

    // Fire push notification to the customer (non-blocking)
    const notif = STATUS_LABELS[status];
    const customerUserId = order.customer?.userId;
    if (notif && customerUserId) {
      const shopName = order.fashionHouse?.shopName || "The Fashion House";
      sendNotificationToUser(
        customerUserId,
        notif.title,
        `${shopName}: ${notif.body}`,
        { orderId: order.id, status }
      );
    }

    return updated;

  }

}

