import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { EscalationsInput } from "./escalations.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

// PATCH /api/escalations/:escalationId/decline
// Works for both Booking records (sets status="declined") and ChatEscalation records (sets resolved=true as a fallback).

@Injectable()
export class EscalationsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async get(input: EscalationsInput<"get">) {

    const fh = await this.getAdminFashionHouseOrThrow(input.authUserId!);
    const [escalations, bookings] = await Promise.all([
      this.database.client.chatEscalation.findMany({
        where: { fashionHouseId: fh.id },
        orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
        include: { customer: { select: { id: true, name: true, email: true } } },
      }),
      this.database.client.booking.findMany({
        where: { fashionHouseId: fh.id },
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, staffId: true, status: true } },
        },
      }),
    ]);

    const formattedBookings = bookings.map((b) => {
      // Source of truth: a booking is "assigned" if an Order has been created for it,
      // OR if the booking.status was explicitly set to assigned/completed.
      // This is resilient to the booking.status update failing silently.
      const hasOrder = !!b.order;
      const orderStatus = b.order?.status;

      let bookingStatus: string;
      if (hasOrder && (orderStatus === "completed" || orderStatus === "delivered")) {
        bookingStatus = "completed";
      } else if (hasOrder || b.status === "assigned") {
        bookingStatus = "assigned";
      } else if (b.status === "declined") {
        bookingStatus = "declined";
      } else {
        bookingStatus = "pending";
      }

      return {
        id: b.id,
        fashionHouseId: b.fashionHouseId,
        customerId: b.customerId,
        customerName: b.customer?.name || b.customer?.email?.split("@")[0] || "Customer",
        reason: b.styleNotes || "Bespoke Fitting Appointment",
        summary: `Appointment requested for ${b.preferredTime} on ${new Date(b.preferredDate).toLocaleDateString()}.`,
        preferredDate: b.preferredDate.toISOString(),
        preferredTime: b.preferredTime,
        resolved: hasOrder || b.status === "assigned" || b.status === "completed" || b.status === "declined",
        bookingStatus,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        customer: b.customer,
      };
    });

    const formattedEscalations = escalations.map((e) => ({
      id: e.id,
      fashionHouseId: e.fashionHouseId,
      customerId: e.customerId,
      customerName: e.customer?.name || e.customer?.email?.split("@")[0] || "Customer",
      reason: e.reason,
      summary: e.summary,
      resolved: e.resolved,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      customer: e.customer,
    }));

    // Deduplicate combined list by id or customerId+reason
    const combined = [...formattedBookings, ...formattedEscalations];
    const seen = new Set<string>();
    const deduplicated = combined.filter((item) => {
      const key = item.id || `${item.customerId}-${item.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduplicated;

  }

  async getByEscalationId(input: EscalationsInput<"getByEscalationId">) {

    const fh = await this.getAdminFashionHouseOrThrow(input.authUserId!);
    const escalation = await this.database.client.chatEscalation.findFirst({
      where: { id: routeParam(input, "escalationId"), fashionHouseId: fh.id },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!escalation) return rejectRequest({ error: "We couldn't find that support request. Please refresh and try again." }, 404);

    const measurements = await this.database.client.measurement.findMany({
      where: {
        customer: { userId: escalation.customerId, fashionHouseId: fh.id },
      },
      orderBy: { recordedAt: "desc" },
    });

    let transcript: unknown[] = [];
    try { transcript = JSON.parse(escalation.transcript); } catch { }
    return {
      ...escalation,
      customer: {
        ...escalation.customer,
        measurements,
      },
      transcript,
    };

  }

  async patchByEscalationIdResolve(input: EscalationsInput<"patchByEscalationIdResolve">) {

    const fh = await this.getAdminFashionHouseOrThrow(input.authUserId!);
    const escalation = await this.database.client.chatEscalation.findFirst({ where: { id: routeParam(input, "escalationId"), fashionHouseId: fh.id } });
    if (!escalation) return rejectRequest({ error: "We couldn't find that support request. Please refresh and try again." }, 404);

    if (input.body.assignToStaffId) {
      const staff = await this.database.client.user.findFirst({ where: { id: input.body.assignToStaffId, fashionHouseId: fh.id, role: "staff" } });
      if (!staff) return rejectRequest({ error: "Staff member not found in this fashion house" }, 404);
    }

    const updated = await this.database.client.chatEscalation.update({
      where: { id: escalation.id, fashionHouseId: fh.id },
      data: { resolved: true, status: "resolved", activeKey: null },
    });
    return updated;

  }

  async patchByEscalationIdDecline(input: EscalationsInput<"patchByEscalationIdDecline">) {

    const fh = await this.getAdminFashionHouseOrThrow(input.authUserId!);
    const escalationId = routeParam(input, "escalationId");

    // 1. Try to decline a Booking and release its tenant-owned fitting slot.
    const booking = await this.database.client.booking.findFirst({
      where: { id: escalationId, fashionHouseId: fh.id },
      select: { id: true, availableSlotId: true },
    });

    if (booking) {
      await this.database.client.$transaction(async (transaction) => {
        await transaction.booking.update({
          where: { id: booking.id },
          data: { status: "declined", availableSlotId: null },
        });
        if (booking.availableSlotId) {
          await transaction.availableSlot.updateMany({
            where: {
              id: booking.availableSlotId,
              fashionHouseId: fh.id,
              booked: true,
            },
            data: { booked: false },
          });
        }
      });
      return { success: true, type: "booking" };
    }

    // 2. Fall back to resolving a ChatEscalation (no dedicated declined state in schema)
    const escalationResult = await this.database.client.chatEscalation.updateMany({
      where: { id: escalationId, fashionHouseId: fh.id },
      data: { resolved: true, status: "resolved", activeKey: null },
    });

    if (escalationResult.count > 0) {
      return { success: true, type: "escalation" };
    }

    return rejectRequest({ error: "We couldn't find that booking or support request. Please refresh and try again." }, 404);

  }

  async postAssign(input: EscalationsInput<"postAssign">) {
    try {
      const fh = await this.getAdminFashionHouseOrThrow(input.authUserId!);
      const { bookingId, staffId, serviceTitle, customerName, price, measurements } = input.body;

      // Validate every supplied foreign reference before any write.
      if (bookingId) {
        if (typeof bookingId !== "string") return rejectRequest({ error: "Invalid booking." }, 400);
        const ownedBooking = await this.database.client.booking.findFirst({
          where: { id: bookingId, fashionHouseId: fh.id }, select: { id: true },
        });
        if (!ownedBooking) return rejectRequest({ error: "Booking not found." }, 404);
      }
      let validStaffId: string | null = null;
      if (staffId) {
        if (typeof staffId !== "string") return rejectRequest({ error: "Invalid staff member." }, 400);
        const staffUser = await this.database.client.user.findFirst({
          where: { id: staffId, fashionHouseId: fh.id, role: "staff" },
        });
        if (!staffUser) return rejectRequest({ error: "Staff member not found." }, 404);
        validStaffId = staffUser.id;
      }

      let targetCustomerId: string | null = null;
      if (bookingId) {
        const dbBooking = await this.database.client.booking.findFirst({
          where: { id: bookingId, fashionHouseId: fh.id },
          select: { customerId: true },
        });
        if (dbBooking?.customerId) {
          const linkedCustomers = await this.database.client.customer.findMany({
            where: { userId: dbBooking.customerId, fashionHouseId: fh.id },
            select: { id: true },
            take: 2,
          });
          if (linkedCustomers.length > 1) {
            return rejectRequest({ error: "This customer has duplicate profiles and requires manual review." }, 409);
          }
          if (linkedCustomers.length === 1) {
            targetCustomerId = linkedCustomers[0].id;
          } else {
            const bookingUser = await this.database.client.user.findUnique({
              where: { id: dbBooking.customerId },
              select: { id: true, name: true, email: true },
            });
            if (!bookingUser) return rejectRequest({ error: "The booking customer could not be resolved." }, 409);
            const linkedCustomer = await this.database.client.customer.create({
              data: {
                fashionHouseId: fh.id,
                userId: bookingUser.id,
                name: bookingUser.name?.trim() || bookingUser.email.split("@")[0],
              },
            });
            targetCustomerId = linkedCustomer.id;
          }
        }
      }

      if (!targetCustomerId && customerName) {
        let customer = await this.database.client.customer.findFirst({
          where: { name: { equals: customerName, mode: "insensitive" }, fashionHouseId: fh.id },
        });
        if (!customer) {
          customer = await this.database.client.customer.create({
            data: {
              fashionHouseId: fh.id,
              name: customerName,
            },
          });
        }
        targetCustomerId = customer.id;
      }

      if (!targetCustomerId) return rejectRequest({ error: "A booking or customer name is required." }, 400);

      const parsedPrice = typeof price === "number" && !isNaN(price) && price >= 0 ? price : 0;
      const cleanBookingId = bookingId ? bookingId : null;

      // 1. Check if an order already exists for this specific booking
      let existingOrder = cleanBookingId
        ? await this.database.client.order.findFirst({
          where: {
            fashionHouseId: fh.id,
            bookingId: cleanBookingId,
          },
        })
        : null;

      let order;
      const initialStatus =
        measurements && typeof measurements === "object" && (measurements.bust || measurements.waist || measurements.hip)
          ? "measurements_confirmed"
          : "booked";

      if (existingOrder) {
        order = await this.database.client.order.update({
          where: { id: existingOrder.id, fashionHouseId: fh.id },
          data: {
            staffId: validStaffId,
            bookingId: cleanBookingId ?? existingOrder.bookingId,
            itemName: serviceTitle || existingOrder.itemName,
            price: parsedPrice > 0 ? parsedPrice : existingOrder.price,
            status: initialStatus,
          },
        });
      } else {
        order = await this.database.client.order.create({
          data: {
            fashionHouseId: fh.id,
            customerId: targetCustomerId,
            bookingId: cleanBookingId,
            itemName: serviceTitle || "Bespoke Fitting",
            price: parsedPrice,
            staffId: validStaffId,
            status: initialStatus,
          },
        });
      }

      // 2. Save customer measurements if provided during assignment
      if (measurements && typeof measurements === "object") {
        const { bust, waist, hip, length } = measurements;
        const mList = [
          { field: "Bust", val: bust },
          { field: "Waist", val: waist },
          { field: "Hips", val: hip },
          { field: "Garment Length", val: length },
        ];

        for (const m of mList) {
          if (m.val && !isNaN(Number(m.val))) {
            await this.database.client.measurement.create({
              data: {
                customerId: targetCustomerId,
                field: m.field,
                value: Number(m.val),
                unit: "in",
              },
            }).catch(() => { });
          }
        }
      }

      // 3. Mark booking request and chat escalation as assigned in database
      if (bookingId) {
        await this.database.client.booking.updateMany({
          where: { id: bookingId, fashionHouseId: fh.id },
          data: { status: "assigned" },
        }).catch(() => { });

        await this.database.client.chatEscalation.updateMany({
          where: { id: bookingId, fashionHouseId: fh.id },
          data: { resolved: true, status: "resolved", activeKey: null },
        }).catch(() => { });
      }

      return { success: true, order };
    } catch (err: any) {
      throw err;
    }
  }

  private async getAdminFashionHouseOrThrow(userId: string) {
    const admin = await this.database.client.user.findUnique({ where: { id: userId }, include: { fashionHouseOwned: true } });
    if (!admin) {
      throw Object.assign(new Error("Your session has expired. Please log in again."), { status: 401 });
    }
    if (admin.role !== "admin") {
      throw Object.assign(new Error("Only the fashion house owner can do this."), { status: 403 });
    }
    if (!admin.fashionHouseOwned) {
      throw Object.assign(new Error("We couldn't find your fashion house. Please log in again."), { status: 404 });
    }
    return admin.fashionHouseOwned;
  }
}

