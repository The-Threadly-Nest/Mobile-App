import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { InvoicesInput } from "./invoices.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

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

// GET Invoice Details by Order ID or Invoice ID

@Injectable()
export class InvoicesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async post(input: InvoicesInput<"post">) {

    const fhId = getOwnFashionHouseId(input);
    const { orderId } = input.body;

    // Tenant Isolation: Verify order exists and belongs to this tenant
    const order = await this.database.client.order.findFirst({
      where: { id: orderId, fashionHouseId: fhId },
      include: { fashionHouse: true },
    });
    if (!order) {
      return rejectRequest({ error: "Order not found." }, 404);
    }

    const { bankName, accountNumber, accountName } = order.fashionHouse;

    // Existing invoices keep their original payment snapshot. Legacy invoices
    // without a snapshot may be completed once from the current tenant profile.
    const existing = await this.database.client.invoice.findFirst({
      where: { orderId, order: { fashionHouseId: fhId } },
      include: invoiceInclude,
    });
    if (existing) {
      if (existing.bankName && existing.accountNumber && existing.accountName) {
        return existing;
      }
      if (!bankName || !accountNumber || !accountName) {
        return rejectRequest({
          code: "PAYMENT_DETAILS_REQUIRED",
          error: "Add the fashion house payment details before generating an invoice.",
        }, 409);
      }

      const completedLegacyInvoice = await this.database.client.invoice.update({
        where: { id: existing.id },
        data: {
          currency: order.fashionHouse.currency,
          bankName,
          accountNumber,
          accountName,
        },
        include: invoiceInclude,
      });
      return completedLegacyInvoice;
    }

    if (!bankName || !accountNumber || !accountName) {
      return rejectRequest({
        code: "PAYMENT_DETAILS_REQUIRED",
        error: "Add the fashion house payment details before generating an invoice.",
      }, 409);
    }

    // Server-Side Recalculation: Calculate Subtotal, 7.5% VAT, and Grand Total
    const subtotal = order.price;
    const taxRate = 0.075;
    const taxAmount = Math.round(subtotal * taxRate);
    const total = subtotal + taxAmount;

    const invoice = await this.database.client.invoice.create({
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

    return result(invoice, 201);

  }

  async getOrderByOrderId(input: InvoicesInput<"getOrderByOrderId">) {

    const fhId = getOwnFashionHouseId(input);
    const invoice = await this.database.client.invoice.findFirst({
      where: { orderId: routeParam(input, "orderId"), order: { fashionHouseId: fhId } },
      include: invoiceInclude,
    });

    if (!invoice || invoice.order.fashionHouseId !== fhId) {
      return rejectRequest({ error: "Invoice not found." }, 404);
    }

    return invoice;

  }

}

