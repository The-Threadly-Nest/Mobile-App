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
    const fhId = getOwnFashionHouseId(req);
    const { orderId } = req.body;

    // Tenant Isolation: Verify order exists and belongs to this tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, fashionHouseId: fhId },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    // Check if invoice already exists
    const existing = await prisma.invoice.findFirst({
      where: { orderId, order: { fashionHouseId: fhId } },
    });
    if (existing) {
      return res.status(400).json({ error: "An invoice has already been generated for this order." });
    }

    // Server-Side Recalculation: Calculate Subtotal, 7.5% VAT, and Grand Total
    const subtotal = order.price;
    const taxRate = 0.075;
    const taxAmount = Math.round(subtotal * taxRate);
    const total = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        orderId,
        subtotal,
        taxRate,
        taxAmount,
        total,
      },
    });

    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// GET Invoice Details by Order ID or Invoice ID
router.get("/order/:orderId", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const invoice = await prisma.invoice.findFirst({
      where: { orderId: req.params.orderId, order: { fashionHouseId: fhId } },
      include: {
        order: {
          include: {
            customer: true,
            fashionHouse: {
              select: {
                shopName: true,
                brandLogoUrl: true,
                bankName: true,
                accountNumber: true,
                accountName: true,
                location: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!invoice || invoice.order.fashionHouseId !== fhId) {
      return res.status(404).json({ error: "Invoice not found." });
    }

    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

export default router;
