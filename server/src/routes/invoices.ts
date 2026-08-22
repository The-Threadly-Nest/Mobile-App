import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";

const generateInvoiceSchema = z.object({
  orderId: z.string().uuid(),
});

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

// Generate Invoice from Order
router.post("/", validate({ body: generateInvoiceSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { orderId } = req.body;

    // Tenant Isolation: Verify order exists and belongs to this tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, fashionHouseId: fhId },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    // Check if invoice already exists
    const existing = await prisma.invoice.findUnique({
      where: { orderId },
    });
    if (existing) {
      return res.status(400).json({ error: "An invoice has already been generated for this order." });
    }

    // Server-Side Recalculation: Never trust client-supplied totals!
    const invoiceTotal = order.price;

    const invoice = await prisma.invoice.create({
      data: {
        orderId,
        total: invoiceTotal,
      },
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

export default router;
