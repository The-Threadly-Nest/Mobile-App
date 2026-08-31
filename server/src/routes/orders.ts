import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createOrderSchema, updateOrderStatusSchema } from "../schemas/orders.schema";

const router = Router();

// GET /api/orders/my-orders — Customer list own bookings & orders
router.get("/my-orders", requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId!;
    const bookings = await prisma.booking.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      include: { fashionHouse: { select: { shopName: true } } },
    });

    const formatted = bookings.map((b, idx) => ({
      id: b.id,
      atelierName: b.fashionHouse?.shopName || "Adaeze Couture",
      garmentType: b.styleNotes || "Aso-Ebi",
      orderNumber: `#TFH-${2300 + idx}`,
      estimatedReady: `Fitting: ${b.preferredTime} on ${new Date(b.preferredDate).toISOString().split("T")[0]}`,
      progressPercent: 20,
      imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=300&q=80",
      status: b.status === "completed" ? "completed" : "active",
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/my-orders — Customer create booking in database
router.post("/my-orders", requireAuth, async (req, res, next) => {
  try {
    const customerId = req.authUserId!;
    const { fashionHouseName, garment, fittingDate } = req.body;

    const fh = (await prisma.fashionHouse.findFirst({
      where: fashionHouseName ? { shopName: { contains: fashionHouseName, mode: "insensitive" } } : undefined,
    })) || (await prisma.fashionHouse.findFirst());

    if (!fh) {
      return res.status(404).json({ error: "Fashion house not found." });
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

    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole("admin", "staff"));

// Create Order
router.post("/", validate({ body: createOrderSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { customerId, itemName, price } = req.body;

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found in your fashion house." });
    }

    const order = await prisma.order.create({
      data: {
        fashionHouseId: fhId,
        customerId,
        itemName,
        price,
        staffId: req.authRole === "staff" ? req.authUserId : null,
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
    const orders = await prisma.order.findMany({
      where: { fashionHouseId: fhId },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, phone: true } },
        staff: { select: { email: true } },
      },
    });
    res.json(orders);
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

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
