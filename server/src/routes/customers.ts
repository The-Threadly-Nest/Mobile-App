import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

// GET /api/customers — List all unique customers for this fashion house with aggregated order counts
router.get("/", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);

    const [dbCustomers, orders, bookings, escalations, directMessages] = await Promise.all([
      prisma.customer.findMany({
        where: { fashionHouseId: fhId },
        include: { orders: { select: { id: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.order.findMany({
        where: { fashionHouseId: fhId },
        include: { customer: { select: { id: true, name: true, phone: true } } },
      }),
      prisma.booking.findMany({
        where: { fashionHouseId: fhId },
        include: { customer: { select: { id: true, name: true, email: true } } },
      }),
      prisma.chatEscalation.findMany({
        where: { fashionHouseId: fhId },
        include: { customer: { select: { id: true, name: true, email: true } } },
      }),
      prisma.directMessage.findMany({
        where: { fashionHouseId: fhId },
        distinct: ["customerId"],
        include: { customer: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const customerMap = new Map<string, { id: string; name: string; phone: string; email?: string; status: string; ordersCount: number }>();
    const orderCountMap = new Map<string, number>();

    // 1. Accumulate total order counts per customer name and ID
    for (const ord of orders) {
      if (ord.customer) {
        const normKey = (ord.customer.name || "").trim().toLowerCase();
        if (normKey) orderCountMap.set(normKey, (orderCountMap.get(normKey) || 0) + 1);
        if (ord.customer.id) orderCountMap.set(ord.customer.id, (orderCountMap.get(ord.customer.id) || 0) + 1);
      }
    }

    const addOrUpdateCustomer = (id: string, rawName?: string | null, phone?: string | null, email?: string | null, status = "active") => {
      const name = (rawName || "Customer").trim();
      const normKey = name.toLowerCase();

      if (!customerMap.has(normKey)) {
        const count = orderCountMap.get(normKey) || orderCountMap.get(id) || 0;
        customerMap.set(normKey, {
          id,
          name,
          phone: phone || "",
          email: email || undefined,
          status,
          ordersCount: count,
        });
      }
    };

    // 2. Add customers from Customer table
    for (const c of dbCustomers) {
      const normKey = (c.name || "Customer").trim().toLowerCase();
      const orderCount = Math.max(c.orders.length, orderCountMap.get(normKey) || 0);
      addOrUpdateCustomer(c.id, c.name, c.phone, (c as any).email, (c as any).status || "active");
      if (customerMap.has(normKey)) {
        customerMap.get(normKey)!.ordersCount = orderCount;
      }
    }

    // 3. Add customers from Orders, Bookings, Escalations, and Direct Messages
    for (const ord of orders) if (ord.customer) addOrUpdateCustomer(ord.customer.id, ord.customer.name, ord.customer.phone);
    for (const b of bookings) if (b.customer) addOrUpdateCustomer(b.customer.id, b.customer.name, null, b.customer.email);
    for (const e of escalations) if (e.customer) addOrUpdateCustomer(e.customer.id, e.customer.name || e.customer.email.split("@")[0], null, e.customer.email);
    for (const dm of directMessages) if (dm.customer) addOrUpdateCustomer(dm.customer.id, dm.customer.name || dm.customer.email.split("@")[0], null, dm.customer.email);

    res.json(Array.from(customerMap.values()));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customers/:id/status — Toggle customer active / inactive lifecycle status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value. Must be 'active' or 'inactive'." });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer record not found." });
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
