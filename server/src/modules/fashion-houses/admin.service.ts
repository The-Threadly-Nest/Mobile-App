import { Inject, Injectable } from "@nestjs/common";
import type { FashionHouseAdminInput } from "./admin.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { isAvailabilityConflictError, isValidTimeZone, slotsOverlap, zonedDateTimeToUtc } from "../../lib/availability";

// Lightweight figures used by the dashboard's background refresh. Keep this
// separate from the settings summary so polling does not repeatedly calculate
// staff, customer, and invoice counts that the dashboard does not display.

// Tenant-wide totals. Database aggregates keep cards accurate even when list
// endpoints are paginated.

// GET /api/admin/profile - Get Admin's fashion house & onboarding status

// PUT /api/admin/onboarding - Complete or update Admin onboarding setup

// PATCH /api/admin/payment-details - Update this tenant's invoice account.

@Injectable()
export class FashionHouseAdminService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async getDashboardSummary(input: FashionHouseAdminInput<"getDashboardSummary">) {

    const fashionHouse = await this.database.client.fashionHouse.findUnique({
      where: { adminId: input.authUserId! },
      select: { id: true },
    });
    if (!fashionHouse) {
      return rejectRequest({ error: "Fashion house profile not found." }, 404);
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const fashionHouseId = fashionHouse.id;

    const [activeOrdersCount, pendingBookingsCount, revenue] = await Promise.all([
      this.database.client.order.count({
        where: {
          fashionHouseId,
          status: { notIn: ["completed", "delivered", "ready_for_pickup", "ready", "cancelled", "declined"] },
        },
      }),
      this.database.client.booking.count({ where: { fashionHouseId, status: "pending_admin_review" } }),
      this.database.client.invoice.aggregate({
        _sum: { total: true },
        where: {
          paymentStatus: "paid",
          createdAt: { gte: monthStart, lt: nextMonthStart },
          order: { fashionHouseId },
        },
      }),
    ]);

    return {
      activeOrdersCount,
      pendingBookingsCount,
      revenueThisMonth: revenue._sum.total ?? 0,
    };

  }

  async getSummary(input: FashionHouseAdminInput<"getSummary">) {

    const fashionHouse = await this.database.client.fashionHouse.findUnique({
      where: { adminId: input.authUserId! },
      select: { id: true },
    });
    if (!fashionHouse) {
      return rejectRequest({ error: "Fashion house profile not found." }, 404);
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const fashionHouseId = fashionHouse.id;

    const [staffCount, customerRows, invoiceCountThisMonth, activeOrdersCount, pendingBookingsCount, revenue] =
      await Promise.all([
        this.database.client.user.count({ where: { fashionHouseId, role: "staff" } }),
        this.database.client.$queryRaw<Array<{ count: bigint }>>`
          WITH "knownCustomers" AS (
            SELECT LOWER(TRIM(c."name")) AS "identity"
            FROM "customers" c
            WHERE c."fashionHouseId" = ${fashionHouseId}
            UNION
            SELECT LOWER(TRIM(COALESCE(u."name", u."email"))) AS "identity"
            FROM "users" u
            WHERE u."role" = 'customer'
              AND (
                EXISTS (SELECT 1 FROM "bookings" b WHERE b."customerId" = u."id" AND b."fashionHouseId" = ${fashionHouseId})
                OR EXISTS (SELECT 1 FROM "chat_escalations" e WHERE e."customerId" = u."id" AND e."fashionHouseId" = ${fashionHouseId})
                OR EXISTS (SELECT 1 FROM "direct_messages" d WHERE d."customerId" = u."id" AND d."fashionHouseId" = ${fashionHouseId})
              )
          )
          SELECT COUNT(*)::BIGINT AS "count" FROM "knownCustomers"
        `,
        this.database.client.invoice.count({
          where: { createdAt: { gte: monthStart, lt: nextMonthStart }, order: { fashionHouseId } },
        }),
        this.database.client.order.count({
          where: {
            fashionHouseId,
            status: { notIn: ["completed", "delivered", "ready_for_pickup", "ready", "cancelled", "declined"] },
          },
        }),
        this.database.client.booking.count({ where: { fashionHouseId, status: "pending_admin_review" } }),
        this.database.client.invoice.aggregate({
          _sum: { total: true },
          where: {
            paymentStatus: "paid",
            createdAt: { gte: monthStart, lt: nextMonthStart },
            order: { fashionHouseId },
          },
        }),
      ]);

    return {
      staffCount,
      customerCount: Number(customerRows[0]?.count ?? 0),
      invoiceCountThisMonth,
      activeOrdersCount,
      pendingBookingsCount,
      revenueThisMonth: revenue._sum.total ?? 0,
    };

  }

  async getProfile(input: FashionHouseAdminInput<"getProfile">) {

    const user = await this.database.client.user.findUnique({ where: { id: input.authUserId! } });
    if (!user) {
      return rejectRequest({ error: "Your session has expired. Please log in again." }, 401);
    }

    const fashionHouse = await this.database.client.fashionHouse.findUnique({
      where: { adminId: input.authUserId! },
      include: {
        availableSlots: {
          where: { startsAt: { gt: new Date() } },
          orderBy: { startsAt: "asc" },
        },
        admin: {
          select: { id: true, email: true, name: true, role: true },
        },
      },
    });

    if (!fashionHouse) {
      return rejectRequest({ error: "Fashion house profile not found." }, 404);
    }

    return { fashionHouse };

  }

  async putOnboarding(input: FashionHouseAdminInput<"putOnboarding">) {
    try {
      const { availableSlots, ...profile } = input.body;
      if (!isValidTimeZone(profile.timezone)) {
        return rejectRequest({ error: "Select a valid timezone for your fashion house." }, 400);
      }
      const now = new Date();
      const canonicalSlots = availableSlots.map((slot: { date: string; time: string }) => ({
        ...slot,
        startsAt: zonedDateTimeToUtc(slot.date, slot.time, profile.timezone),
        durationMinutes: profile.slotDurationMinutes,
      }));
      if (canonicalSlots.some((slot: { startsAt: Date }) => slot.startsAt <= now)) {
        return rejectRequest({ error: "Fitting slots must be scheduled in the future." }, 400);
      }
      for (let index = 0;index < canonicalSlots.length;index += 1) {
        if (canonicalSlots.slice(index + 1).some((other: { startsAt: Date; durationMinutes: number }) =>
          slotsOverlap(canonicalSlots[index].startsAt, canonicalSlots[index].durationMinutes, other)
        )) {
          return rejectRequest({ error: "Two fitting slots overlap. Choose separate appointment times." }, 409);
        }
      }

      const updatedHouse = await this.database.client.$transaction(async (tx) => {
        const fashionHouse = await tx.fashionHouse.upsert({
          where: { adminId: input.authUserId! },
          create: {
            adminId: input.authUserId!,
            ...profile,
            onboardingCompleted: true,
          },
          update: {
            ...profile,
            onboardingCompleted: true,
          },
        });

        const protectedSlots = await tx.availableSlot.findMany({
          where: { fashionHouseId: fashionHouse.id, booked: true, startsAt: { not: null } },
          select: { startsAt: true, durationMinutes: true },
        });
        const conflictsWithBooking = canonicalSlots.some((slot: { startsAt: Date; durationMinutes: number }) =>
          protectedSlots.some((existing) =>
            existing.startsAt?.getTime() !== slot.startsAt.getTime() &&
            slotsOverlap(slot.startsAt, slot.durationMinutes, existing)
          )
        );
        if (conflictsWithBooking) {
          throw Object.assign(new Error("A new fitting slot overlaps an existing booking."), { status: 409 });
        }

        // Onboarding owns the house's unbooked schedule. Existing booked slots
        // stay intact so an established appointment can never be erased here.
        await tx.availableSlot.deleteMany({
          where: {
            fashionHouseId: fashionHouse.id,
            booked: false,
          },
        });

        await tx.availableSlot.createMany({
          data: canonicalSlots.map((slot: { date: string; time: string; startsAt: Date; durationMinutes: number }) => ({
            fashionHouseId: fashionHouse.id,
            date: slot.date,
            time: slot.time,
            startsAt: slot.startsAt,
            endsAt: new Date(slot.startsAt.getTime() + slot.durationMinutes * 60_000),
            durationMinutes: slot.durationMinutes,
            active: true,
            booked: false,
          })),
          skipDuplicates: true,
        });

        return tx.fashionHouse.findUniqueOrThrow({
          where: { id: fashionHouse.id },
          include: {
            availableSlots: {
              where: { startsAt: { gt: new Date() } },
              orderBy: { startsAt: "asc" },
            },
          },
        });
      });

      return {
        message: "Admin profile and onboarding saved successfully.",
        fashionHouse: updatedHouse,
      };
    } catch (err) {
      if (isAvailabilityConflictError(err)) {
        return rejectRequest({ error: "Two fitting slots overlap. Choose separate appointment times." }, 409);
      }
      throw err;
    }
  }

  async patchPaymentDetails(input: FashionHouseAdminInput<"patchPaymentDetails">) {

    const fashionHouse = await this.database.client.fashionHouse.update({
      where: { adminId: input.authUserId! },
      data: {
        bankName: input.body.bankName,
        accountNumber: input.body.accountNumber,
        accountName: input.body.accountName,
      },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    });

    return { message: "Payment details saved.", fashionHouse };

  }

}

