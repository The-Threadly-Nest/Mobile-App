import { orderAccessWhere, bookingAccessWhere } from "../lib/authorization";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema, updateOrderStatusSchema } from "../schemas/orders.schema";
import { parseFittingDate, formatEstimatedReady } from "../utils/dateUtils";
import { sendNotificationToUser, sendNotificationToAdmin } from "../lib/notifications";

const STATUS_LABELS: Record<string, { title: string; body: string }> = {
  pending_admin_review:  { title: "Order Received ✅",         body: "Your order is under review by the fashion house." },
  measurements_confirmed:{ title: "Measurements Confirmed 📏",  body: "Your measurements have been confirmed. Production begins soon!" },
  fabric_sourced:        { title: "Fabric Sourced 🧵",          body: "The perfect fabric for your garment has been sourced." },
  in_production:         { title: "In Production ✂️",          body: "Your garment is now being crafted by our tailors." },
  quality_check:         { title: "Quality Check 🔍",           body: "Final quality checks are underway on your order." },
  ready_for_pickup:      { title: "Ready for Pickup 🎉",        body: "Your garment is ready! Come pick it up at your convenience." },
  ready:                 { title: "Ready for Pickup 🎉",        body: "Your garment is ready! Come pick it up at your convenience." },
  completed:             { title: "Order Completed 🌟",         body: "Thank you! Your order has been marked as completed." },
  delivered:             { title: "Order Delivered 📦",         body: "Your garment has been delivered. Enjoy wearing it!" },
  cancelled:             { title: "Order Cancelled",            body: "Your order has been cancelled. Contact us if you have questions." },
};

const router = Router();

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
  for (let i = 0; i < cleanId.length; i++) {
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

  if (lowerTitle.includes("vintage") || lowerTitle.includes("shirt")) {
    return "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&q=80";
  } else if (lowerTitle.includes("adire")) {
    return "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=500&q=80";
  } else if (lowerTitle.includes("2piece") || lowerTitle.includes("2 piece") || lowerTitle.includes("suit") || lowerTitle.includes("agbada")) {
    return "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&q=80";
  } else if (lowerTitle.includes("kaftan")) {
    return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80";
  }

  if (fashionHouse?.brandLogoUrl) return fashionHouse.brandLogoUrl;

  return "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&q=80";
}

// GET /api/orders/my-orders — Customer list own bookings & orders
router.get("/my-orders", requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId!;
    const bookings = await prisma.booking.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        fashionHouse: {
          select: {
            id: true,
            shopName: true,
            catalogItems: { select: { id: true, name: true, imageUrl: true } },
          },
        },
        order: { select: { id: true, status: true } },
      },
    });

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

      if (!realImage) {
        if (lowerNotes.includes("vintage") || lowerNotes.includes("shirt")) {
          realImage = "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&q=80";
        } else if (lowerNotes.includes("adire")) {
          realImage = "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=500&q=80";
        } else if (
          lowerNotes.includes("2piece") ||
          lowerNotes.includes("2 piece") ||
          lowerNotes.includes("suit") ||
          lowerNotes.includes("agbada")
        ) {
          realImage = "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&q=80";
        } else if (lowerNotes.includes("kaftan")) {
          realImage = "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80";
        } else {
          realImage = "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=500&q=80";
        }
      }

      return {
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

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/my-orders — Customer create booking in database
router.post("/my-orders", requireAuth, async (req, res, next) => {
  try {
    const customerId = req.authUserId!;
    const { fashionHouseId, fashionHouseName, garment, fittingDate } = req.body;

    let fh = null;
    if (fashionHouseId) {
      fh = await prisma.fashionHouse.findUnique({ where: { id: fashionHouseId } });
    }
    if (!fh && fashionHouseName) {
      fh = await prisma.fashionHouse.findFirst({
        where: { shopName: { contains: fashionHouseName, mode: "insensitive" } },
      });
    }
    if (!fh) {
      fh = await prisma.fashionHouse.findFirst();
    }

    if (!fh) {
      return res.status(404).json({ error: "Fashion house not found." });
    }

    const parsedDate = parseFittingDate(fittingDate);

    // Deduplication check: if a booking was created in the last 2 minutes for this customer & fashion house, update it instead of creating a duplicate
    const recentCutoff = new Date(Date.now() - 2 * 60 * 1000);
    const existingPending = await prisma.booking.findFirst({
      where: {
        customerId,
        fashionHouseId: fh.id,
        status: "pending_admin_review",
        createdAt: { gte: recentCutoff },
      },
    });

    if (existingPending) {
      const updated = await prisma.booking.update({
        where: { id: existingPending.id },
        data: {
          styleNotes: garment || existingPending.styleNotes,
          preferredDate: parsedDate,
          preferredTime: fittingDate || existingPending.preferredTime,
        },
      });
      return res.status(200).json(updated);
    }

    const booking = await prisma.booking.create({
      data: {
        fashionHouseId: fh.id,
        customerId,
        styleNotes: garment || "Aso-Ebi",
        preferredDate: parsedDate,
        preferredTime: fittingDate || "10:00 AM",
        status: "pending_admin_review",
      },
    });

    // Clear chat session history so subsequent visits start fresh
    await prisma.chatSession.updateMany({
      where: { customerId, fashionHouseId: fh.id },
      data: { history: [] },
    }).catch(() => {});

    // Notify admin of new booking (non-blocking)
    sendNotificationToAdmin(
      fh.id,
      "New Booking Request 📋",
      `A customer has requested a fitting appointment.`,
      { bookingId: booking.id }
    );

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/track/:id — Customer or Staff fetch booking/order tracking details
router.get("/track/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.authUserId!;
    const isStaffOrAdmin = req.authRole === "admin" || req.authRole === "staff";

    // Fire both lookups in parallel — whichever resolves with a record wins
    const [booking, order] = await Promise.all([
      prisma.booking.findFirst({
        where: {
          id,
          ...bookingAccessWhere(req),
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
      prisma.order.findFirst({
        where: { id, ...orderAccessWhere(req) },
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

      return res.json({
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
      });
    }

    if (order) {
      if (!isStaffOrAdmin && order.customer.userId !== userId) {
        return res.status(403).json({ error: "Access denied." });
      }

      const garmentType = order.itemName || "Bespoke Garment";
      const imageUrl = resolveGarmentImageUrl(garmentType, order.fashionHouse);

      return res.json({
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
      });
    }

    return res.status(404).json({ error: "Booking or order not found." });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/track/:id/cancel — Customer or Admin/Staff cancel booking/order
router.post("/track/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.authUserId!;
    const isStaffOrAdmin = req.authRole === "admin" || req.authRole === "staff";

    const [booking, order] = await Promise.all([
      prisma.booking.findFirst({
        where: {
          id,
          ...bookingAccessWhere(req),
        },
      }),
      prisma.order.findFirst({
        where: { id, ...orderAccessWhere(req) },
        include: { customer: { select: { userId: true } } },
      }),
    ]);

    if (!booking && !order) {
      return res.status(404).json({ error: "Booking or order not found." });
    }

    if (order && !isStaffOrAdmin && order.customer.userId !== userId) {
      return res.status(403).json({ error: "Access denied." });
    }

    const currentStatus = order?.status || booking?.status || "booked";
    const nonCancellable = ["fabric_sourced", "in_production", "quality_check", "ready_for_pickup", "ready", "completed", "delivered"];
    if (nonCancellable.includes(currentStatus)) {
      return res.status(400).json({
        error: "This order is already in production and cannot be self-cancelled. Please contact concierge for assistance.",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (booking) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "cancelled" },
        });
      }
      if (order) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "cancelled" },
        });
      }
    });

    res.json({ success: true, message: "Order cancelled successfully.", status: "cancelled" });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole("admin", "staff"));

// Create Order (Admin / Staff)
router.post("/", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { customerId, itemName, price, staffId } = req.body;

    if (!customerId || !itemName || !price) {
      return res.status(400).json({ error: "customerId, itemName, and price are required." });
    }

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found in your fashion house." });
    }

    const assignedStaffId = staffId || (req.authRole === "staff" ? req.authUserId : null);

    if (assignedStaffId) {
      const staff = await prisma.user.findFirst({
        where: { id: assignedStaffId, fashionHouseId: fhId, role: "staff", active: true },
        select: { id: true },
      });
      if (!staff) return res.status(404).json({ error: "Staff member not found." });
    }

    const order = await prisma.order.create({
      data: {
        fashionHouseId: fhId,
        customerId,
        itemName,
        price,
        staffId: assignedStaffId,
        status: "order_placed",
      },
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// List Orders
router.get("/", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const whereClause: any = { fashionHouseId: fhId };

    if (req.authRole === "staff") {
      whereClause.OR = [
        { staffId: req.authUserId },
        { staffId: null },
      ];
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        staff: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// Get Single Order Details (Admin & Staff)
router.get("/:id", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
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
      return res.status(404).json({ error: "Order not found." });
    }

    let measurements = order.customer.measurements || [];

    res.json({
      ...order,
      customer: {
        ...order.customer,
        measurements,
      },
    });
  } catch (err) {
    next(err);
  }
});


// Admin Assign Staff Member to Order
router.patch("/:id/assign", requireRole("admin"), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { staffId } = req.body;

    const order = await prisma.order.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (staffId) {
      const staffUser = await prisma.user.findFirst({
        where: { id: staffId, fashionHouseId: fhId, role: "staff" },
      });
      if (!staffUser) {
        return res.status(404).json({ error: "Staff member not found in your fashion house." });
      }
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id, fashionHouseId: fhId },
      data: { staffId: staffId || null },
      include: {
        staff: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Update Status
router.patch("/:id/status", validate({ body: updateOrderStatusSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { status } = req.body;

    // Tenant Isolation: Verify order belongs to this tenant — also pull customer & fashion house for notification
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
      include: {
        customer: { select: { userId: true, name: true } },
        fashionHouse: { select: { shopName: true } },
      },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id, fashionHouseId: fhId },
      data: { status },
    });

    if (order.bookingId) {
      await prisma.booking.update({
        where: { id: order.bookingId, fashionHouseId: fhId },
        data: { status },
      }).catch(() => {});
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

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
