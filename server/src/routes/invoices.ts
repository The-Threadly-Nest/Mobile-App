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

const invoiceInclude = {
  order: {
    include: {
      customer: true,
      fashionHouse: {
        select: {
          shopName: true,
          brandLogoUrl: true,
          location: true,
          phone: true,
        },
      },
    },
  },
} as const;

// Generate Invoice from Order
router.post("/", validate({ body: generateInvoiceSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { orderId } = req.body;

    // Tenant Isolation: Verify order exists and belongs to this tenant
    const order = await prisma.order.findFirst({
      where: { id: orderId, fashionHouseId: fhId },
      include: { fashionHouse: true },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const { bankName, accountNumber, accountName } = order.fashionHouse;

    // Existing invoices keep their original payment snapshot. Legacy invoices
    // without a snapshot may be completed once from the current tenant profile.
    const existing = await prisma.invoice.findFirst({
      where: { orderId, order: { fashionHouseId: fhId } },
      include: invoiceInclude,
    });
    if (existing) {
      if (existing.bankName && existing.accountNumber && existing.accountName) {
        return res.json(existing);
      }
      if (!bankName || !accountNumber || !accountName) {
        return res.status(409).json({
          code: "PAYMENT_DETAILS_REQUIRED",
          error: "Add the fashion house payment details before generating an invoice.",
        });
      }

      const completedLegacyInvoice = await prisma.invoice.update({
        where: { id: existing.id },
        data: {
          currency: order.fashionHouse.currency,
          bankName,
          accountNumber,
          accountName,
        },
        include: invoiceInclude,
      });
      return res.json(completedLegacyInvoice);
    }

    if (!bankName || !accountNumber || !accountName) {
      return res.status(409).json({
        code: "PAYMENT_DETAILS_REQUIRED",
        error: "Add the fashion house payment details before generating an invoice.",
      });
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
        currency: order.fashionHouse.currency,
        paymentStatus: "unpaid",
        bankName,
        accountNumber,
        accountName,
      },
      include: invoiceInclude,
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
      include: invoiceInclude,
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
