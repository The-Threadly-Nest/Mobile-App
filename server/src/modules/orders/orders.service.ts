import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { OrdersInput } from "./orders.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { orderAccessWhere, bookingAccessWhere, availableSlotClaimWhere } from "../../lib/authorization";
import { prepareCatalogOrder } from "../../lib/catalog-commerce";
import { ConflictError, NotFoundError, BadRequestError } from "../../utils/errors";

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
  if (!lowerTitle) return "";
  if (fashionHouse?.catalogItems && fashionHouse.catalogItems.length > 0) {
    const match = fashionHouse.catalogItems.find(
      (item: any) => lowerTitle.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(lowerTitle)
    );
    if (match?.imageUrl) return match.imageUrl;
  }

  return "";
}

function snapshotImage(snapshot: unknown): string {
  if (Array.isArray(snapshot)) return snapshotImage(snapshot[0]);
  return snapshot && typeof snapshot === "object" && "imageUrl" in snapshot && typeof snapshot.imageUrl === "string" ? snapshot.imageUrl : "";
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

  async postMeasurementBooking(input: OrdersInput<"postMeasurementBooking">) {
    const customerId = input.authUserId!;
    const idempotencyKey = readIdempotencyKey(input.headers);
    if (!idempotencyKey) throw new BadRequestError("Please select your measurement appointment again.");
    const { catalogItemId, availableSlotId, notes } = input.body;
    const findPrior = () => this.database.client.booking.findFirst({ where: { customerId, idempotencyKey }, include: { availableSlot: true, fashionHouse: { select: { shopName: true, timezone: true } } } });
    const prior = await findPrior();
    if (prior) {
      if (prior.catalogItemId !== catalogItemId || prior.availableSlotId !== availableSlotId) throw new ConflictError("That request was already used. Please choose your appointment again.");
      return result(prior, 200);
    }
    let booking;
    try {
      booking = await this.database.client.$transaction(async tx => {
        const item = await tx.catalogItem.findUnique({ where: { id: catalogItemId } });
        if (!item) throw new NotFoundError("This item is no longer available.");
        if (item.fulfillmentType !== "custom_fit") throw new BadRequestError("This item is ready for pickup. Choose your size and add it to your cart.");
        const claim = { ...availableSlotClaimWhere(availableSlotId, item.fashionHouseId), booking: { is: null } };
        const claimed = await tx.availableSlot.updateMany({ where: claim, data: { booked: true } });
        if (claimed.count !== 1) throw new ConflictError("That appointment is no longer available. Please choose another time.");
        const slot = await tx.availableSlot.findUniqueOrThrow({ where: { id: availableSlotId } });
        if (!slot.startsAt) throw new ConflictError("Please choose another appointment time.");
        return tx.booking.create({ data: {
          customerId, fashionHouseId: item.fashionHouseId, availableSlotId, catalogItemId, purpose: "measurement",
          catalogSnapshot: { id: item.id, name: item.name, imageUrl: item.imageUrl, priceFrom: item.priceFrom },
          styleNotes: "Measurement for " + item.name + (notes ? ": " + notes : ""),
          preferredDate: slot.startsAt, preferredTime: slot.time, isFirstTime: true,
          status: "pending_admin_review", idempotencyKey,
        }, include: { availableSlot: true, fashionHouse: { select: { shopName: true, timezone: true } } } });
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = await findPrior();
        if (existing && existing.catalogItemId === catalogItemId && existing.availableSlotId === availableSlotId) return result(existing, 200);
      }
      throw error;
    }
    const bookingCustomer = await this.database.client.user.findUnique({ where: { id: customerId }, select: { name: true } }).catch(() => null);
    void sendNotificationToAdmin(booking.fashionHouseId, "New measurement request", `${bookingCustomer?.name || "A customer"} booked a measurement appointment.`, { screen: "orders", bookingId: booking.id, senderId: customerId });
    return result(booking, 201);
  }

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
      let realImage = snapshotImage(b.catalogSnapshot);
      const lowerNotes = (b.styleNotes || "").toLowerCase();
      if (!realImage && lowerNotes && b.fashionHouse?.catalogItems && b.fashionHouse.catalogItems.length > 0) {
        const match = b.fashionHouse.catalogItems.find(
          (item) => lowerNotes.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(lowerNotes)
        );
        if (match?.imageUrl) {
          realImage = match.imageUrl;
        }
      }

      return {
        _createdAt: b.createdAt,
        id: b.id,
        orderId: b.order?.id,
        bookingId: b.id,
        purpose: b.purpose,
        catalogItemId: b.catalogItemId,
        atelierName: b.fashionHouse?.shopName || "Fashion House",
        garmentType: b.styleNotes || "Bespoke Fitting",
        orderNumber: generateOrderNumberServer(canonicalId),
        estimatedReady: (b.purpose === "measurement" ? "Measurement: " : "") + formatEstimatedReady(b.preferredTime, b.preferredDate),
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
        imageUrl: snapshotImage(order.items) || resolveGarmentImageUrl(order.itemName, order.fashionHouse),
        items: order.items,
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
    if (!idempotencyKey) throw new BadRequestError("We couldn't confirm this order request. Please refresh your cart and try again.");
    const { fashionHouseId, items } = input.body;
    const findPrior = () => this.database.client.order.findFirst({
      where: { fashionHouseId, idempotencyKey, customer: { userId } },
      include: { fashionHouse: { select: { shopName: true } } },
    });
    const priorOrder = await findPrior();
    if (priorOrder) return result(priorOrder, 200);
    let order;
    try {
      order = await this.database.client.$transaction(async tx => {
        const [catalogItems, user, house] = await Promise.all([
          tx.catalogItem.findMany({ where: { id: { in: [...new Set(items.map(item => item.catalogItemId))] }, fashionHouseId } }),
          tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
          tx.fashionHouse.findUnique({ where: { id: fashionHouseId }, select: { id: true } }),
        ]);
        if (!house) throw new NotFoundError("Fashion house not found.");
        const prepared = prepareCatalogOrder(catalogItems, items);
        let customer = await tx.customer.findFirst({ where: { fashionHouseId, userId } });
        if (!customer) customer = await tx.customer.create({ data: { fashionHouseId, userId, name: user?.name || user?.email || "Customer", status: "active" } });
        return tx.order.create({
          data: { fashionHouseId, customerId: customer.id, itemName: prepared.itemName, items: prepared.items, price: prepared.total, status: "order_placed", idempotencyKey },
          include: { fashionHouse: { select: { shopName: true } } },
        });
      });
    } catch (error) {
      // PostgreSQL aborts a failed transaction: query idempotent retries outside it.
      if (isUniqueConstraintError(error)) {
        const existing = await findPrior();
        if (existing) return result(existing, 200);
      }
      throw error;
    }
    const orderCustomer = await this.database.client.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    void sendNotificationToAdmin(fashionHouseId, "New order", `You have an order from ${orderCustomer?.name || "a customer"}.`, { screen: "orders", orderId: order.id, senderId: userId });
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
      const imageUrl = snapshotImage(booking.catalogSnapshot) || resolveGarmentImageUrl(garmentType, booking.fashionHouse);

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
      const imageUrl = snapshotImage(order.items) || resolveGarmentImageUrl(garmentType, order.fashionHouse);

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
        estimatedReady: order.status === "order_placed" ? "Awaiting fashion house confirmation" : order.status.replace(/_/g, " "),
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
      const booking = await this.database.client.booking.findFirst({
        where: { id: routeParam(input, "id"), fashionHouseId: fhId },
        include: { customer: { select: { id: true, name: true, email: true } }, availableSlot: true },
      });
      if (!booking) return rejectRequest({ error: "Order or appointment not found." }, 404);
      const customer = await this.database.client.customer.findFirst({ where: { fashionHouseId: fhId, userId: booking.customerId }, include: { measurements: { orderBy: { recordedAt: "desc" } } } });
      return { id: booking.id, bookingId: booking.id, isBooking: true, purpose: booking.purpose, itemName: booking.styleNotes, status: booking.status, createdAt: booking.createdAt, price: null,
        availableSlot: booking.availableSlot, preferredDate: booking.preferredDate, preferredTime: booking.preferredTime,
        customer: { ...booking.customer, phone: customer?.phone ?? null, measurements: customer?.measurements ?? [] }, staff: null };
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

