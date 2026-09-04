import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema, updateOrderStatusSchema } from "../schemas/orders.schema";

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

// GET /api/orders/my-orders — Customer list own bookings & orders
router.get("/my-orders", requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId!;
    const bookings = await prisma.booking.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        fashionHouse: { select: { shopName: true } },
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

      return {
        id: b.id,
        orderId: b.order?.id,
        bookingId: b.id,
        atelierName: b.fashionHouse?.shopName || "Fashion House",
        garmentType: b.styleNotes || "Bespoke Fitting",
        orderNumber: generateOrderNumberServer(canonicalId),
        estimatedReady: `Fitting: ${b.preferredTime} on ${new Date(b.preferredDate).toISOString().split("T")[0]}`,
        progressPercent: getProgressPercent(currentStatus),
        imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=300&q=80",
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
        preferredDate: new Date(),
        preferredTime: fittingDate || "10:00 AM",
        status: "pending_admin_review",
      },
    });

    // Clear chat session history so subsequent visits start fresh
    await prisma.chatSession.updateMany({
      where: { customerId, fashionHouseId: fh.id },
      data: { history: [] },
    }).catch(() => {});

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

    // 1. Try finding booking
    const booking: any = await prisma.booking.findFirst({
      where: {
        id,
        ...(req.authRole === "customer" ? { customerId: userId } : {}),
      },
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, location: true, phone: true, brandLogoUrl: true },
        },
        order: {
          include: {
            staff: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (booking) {
      const currentStatus = booking.order?.status || booking.status;
      return res.json({
        id: booking.id,
        orderId: booking.order?.id,
        atelierName: booking.fashionHouse?.shopName || "Luxury Fashion House",
        fashionHouseId: booking.fashionHouseId,
        fashionHousePhone: booking.fashionHouse?.phone,
        fashionHouseLocation: booking.fashionHouse?.location,
        garmentType: booking.order?.itemName || booking.styleNotes || "Bespoke Garment",
        status: currentStatus,
        progressPercent: getProgressPercent(currentStatus),
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        estimatedReady: `Fitting: ${booking.preferredTime} on ${new Date(booking.preferredDate).toISOString().split("T")[0]}`,
        price: booking.order?.price,
        imageUrl: booking.fashionHouse?.brandLogoUrl || "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&q=80",
        staff: booking.order?.staff
          ? {
              name: booking.order.staff.name,
              email: booking.order.staff.email,
            }
          : null,
      });
    }

    // 2. Try finding order directly
    const order = await prisma.order.findFirst({
      where: { id },
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, location: true, phone: true, brandLogoUrl: true },
        },
        customer: { select: { id: true, name: true, phone: true, userId: true } },
        staff: { select: { id: true, name: true, email: true } },
      },
    });

    if (order) {
      if (req.authRole === "customer" && order.customer.userId !== userId) {
        return res.status(403).json({ error: "Access denied." });
      }

      return res.json({
        id: order.id,
        orderId: order.id,
        atelierName: order.fashionHouse?.shopName || "Luxury Fashion House",
        fashionHouseId: order.fashionHouseId,
        fashionHousePhone: order.fashionHouse?.phone,
        fashionHouseLocation: order.fashionHouse?.location,
        garmentType: order.itemName || "Bespoke Garment",
        status: order.status,
        progressPercent: getProgressPercent(order.status),
        estimatedReady: "In Production",
        price: order.price,
        imageUrl: order.fashionHouse?.brandLogoUrl || "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&q=80",
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

router.use(requireAuth, requireRole("admin", "staff"));

// Create Order (Admin / Staff)
router.post("/", async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
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
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
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
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
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
    if (measurements.length === 0 && order.customer.userId) {
      const userMeasurements = await prisma.measurement.findMany({
        where: { customerId: order.customer.userId },
        orderBy: { recordedAt: "desc" },
      });
      if (userMeasurements.length > 0) {
        measurements = userMeasurements;
      }
    }

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
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
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
      where: { id: req.params.id },
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
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { status } = req.body;

    // Tenant Isolation: Verify order belongs to this tenant
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });

    if (order.bookingId) {
      await prisma.booking.update({
        where: { id: order.bookingId },
        data: { status },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
