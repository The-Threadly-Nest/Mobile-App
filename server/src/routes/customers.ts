import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

// GET /api/customers — List all customers for this fashion house with real order counts
router.get("/", async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);

    const [dbCustomers, orders, bookings, escalations] = await Promise.all([
      prisma.customer.findMany({
        where: { fashionHouseId: fhId },
        include: {
          orders: { select: { id: true } },
          measurements: { select: { id: true } },
        },
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
    ]);

    const customerMap = new Map<string, { id: string; name: string; phone: string; email?: string; ordersCount: number }>();

    // 1. Process customers directly from Customer table
    for (const c of dbCustomers) {
      customerMap.set(c.id, {
        id: c.id,
        name: c.name || "Customer",
        phone: c.phone || "+234 800 000 0000",
        ordersCount: c.orders.length,
      });
    }

    // 2. Count orders per customer & supplement any customers from orders
    for (const ord of orders) {
      if (ord.customer) {
        const existing = customerMap.get(ord.customer.id);
        if (existing) {
          existing.ordersCount = Math.max(existing.ordersCount, (existing.ordersCount || 0) + 1);
        } else {
          customerMap.set(ord.customer.id, {
            id: ord.customer.id,
            name: ord.customer.name || "Customer",
            phone: ord.customer.phone || "+234 800 000 0000",
            ordersCount: 1,
          });
        }
      }
    }

    // 3. Supplement any customers from bookings or escalations
    for (const b of bookings) {
      if (b.customer) {
        const key = b.customer.id;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            id: b.customer.id,
            name: b.customer.name || "Customer",
            phone: "+234 800 000 0000",
            ordersCount: 1,
          });
        }
      }
    }

    for (const e of escalations) {
      if (e.customer) {
        const key = e.customer.id;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            id: e.customer.id,
            name: e.customer.name || e.customer.email.split("@")[0],
            phone: "+234 800 000 0000",
            email: e.customer.email,
            ordersCount: 1,
          });
        }
      }
    }

    const formatted = Array.from(customerMap.values());
    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

export default router;
