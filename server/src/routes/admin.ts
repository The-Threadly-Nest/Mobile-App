import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { adminOnboardingSchema, paymentDetailsSchema } from "../schemas/admin.schema";
import { isAvailabilityConflictError, isValidTimeZone, slotsOverlap, zonedDateTimeToUtc } from "../lib/availability";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// Lightweight figures used by the dashboard's background refresh. Keep this
// separate from the settings summary so polling does not repeatedly calculate
// staff, customer, and invoice counts that the dashboard does not display.
router.get("/dashboard-summary", async (req, res, next) => {
  try {
    const fashionHouse = await prisma.fashionHouse.findUnique({
      where: { adminId: req.authUserId! },
      select: { id: true },
    });
    if (!fashionHouse) {
      return res.status(404).json({ error: "Fashion house profile not found." });
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const fashionHouseId = fashionHouse.id;

    const [activeOrdersCount, pendingBookingsCount, revenue] = await Promise.all([
      prisma.order.count({
        where: {
          fashionHouseId,
          status: { notIn: ["completed", "delivered", "ready_for_pickup", "ready", "cancelled", "declined"] },
        },
      }),
      prisma.booking.count({ where: { fashionHouseId, status: "pending_admin_review" } }),
      prisma.invoice.aggregate({
        _sum: { total: true },
        where: {
          paymentStatus: "paid",
          createdAt: { gte: monthStart, lt: nextMonthStart },
          order: { fashionHouseId },
        },
      }),
    ]);

    res.json({
      activeOrdersCount,
      pendingBookingsCount,
      revenueThisMonth: revenue._sum.total ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// Tenant-wide totals. Database aggregates keep cards accurate even when list
// endpoints are paginated.
router.get("/summary", async (req, res, next) => {
  try {
    const fashionHouse = await prisma.fashionHouse.findUnique({
      where: { adminId: req.authUserId! },
      select: { id: true },
    });
    if (!fashionHouse) {
      return res.status(404).json({ error: "Fashion house profile not found." });
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const fashionHouseId = fashionHouse.id;

    const [staffCount, customerRows, invoiceCountThisMonth, activeOrdersCount, pendingBookingsCount, revenue] =
      await Promise.all([
        prisma.user.count({ where: { fashionHouseId, role: "staff" } }),
        prisma.$queryRaw<Array<{ count: bigint }>>`
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
        prisma.invoice.count({
          where: { createdAt: { gte: monthStart, lt: nextMonthStart }, order: { fashionHouseId } },
        }),
        prisma.order.count({
          where: {
            fashionHouseId,
            status: { notIn: ["completed", "delivered", "ready_for_pickup", "ready", "cancelled", "declined"] },
          },
        }),
        prisma.booking.count({ where: { fashionHouseId, status: "pending_admin_review" } }),
        prisma.invoice.aggregate({
          _sum: { total: true },
          where: {
            paymentStatus: "paid",
            createdAt: { gte: monthStart, lt: nextMonthStart },
            order: { fashionHouseId },
          },
        }),
      ]);

    res.json({
      staffCount,
      customerCount: Number(customerRows[0]?.count ?? 0),
      invoiceCountThisMonth,
      activeOrdersCount,
      pendingBookingsCount,
      revenueThisMonth: revenue._sum.total ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/profile - Get Admin's fashion house & onboarding status
router.get("/profile", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUserId! } });
    if (!user) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }

    const fashionHouse = await prisma.fashionHouse.findUnique({
      where: { adminId: req.authUserId! },
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
      return res.status(404).json({ error: "Fashion house profile not found." });
    }

    res.json({ fashionHouse });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/onboarding - Complete or update Admin onboarding setup
router.put("/onboarding", validate({ body: adminOnboardingSchema }), async (req, res, next) => {
  try {
    const { availableSlots, ...profile } = req.body;
    if (!isValidTimeZone(profile.timezone)) {
      return res.status(400).json({ error: "Select a valid timezone for your fashion house." });
    }
    const now = new Date();
    const canonicalSlots = availableSlots.map((slot: { date: string; time: string }) => ({
      ...slot,
      startsAt: zonedDateTimeToUtc(slot.date, slot.time, profile.timezone),
      durationMinutes: profile.slotDurationMinutes,
    }));
    if (canonicalSlots.some((slot: { startsAt: Date }) => slot.startsAt <= now)) {
      return res.status(400).json({ error: "Fitting slots must be scheduled in the future." });
    }
    for (let index = 0; index < canonicalSlots.length; index += 1) {
      if (canonicalSlots.slice(index + 1).some((other: { startsAt: Date; durationMinutes: number }) =>
        slotsOverlap(canonicalSlots[index].startsAt, canonicalSlots[index].durationMinutes, other)
      )) {
        return res.status(409).json({ error: "Two fitting slots overlap. Choose separate appointment times." });
      }
    }

    const updatedHouse = await prisma.$transaction(async (tx) => {
      const fashionHouse = await tx.fashionHouse.upsert({
        where: { adminId: req.authUserId! },
        create: {
          adminId: req.authUserId!,
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

    res.json({
      message: "Admin profile and onboarding saved successfully.",
      fashionHouse: updatedHouse,
    });
  } catch (err) {
    if (isAvailabilityConflictError(err)) {
      return res.status(409).json({ error: "Two fitting slots overlap. Choose separate appointment times." });
    }
    next(err);
  }
});

// PATCH /api/admin/payment-details - Update this tenant's invoice account.
router.patch("/payment-details", validate({ body: paymentDetailsSchema }), async (req, res, next) => {
  try {
    const fashionHouse = await prisma.fashionHouse.update({
      where: { adminId: req.authUserId! },
      data: {
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        accountName: req.body.accountName,
      },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
      },
    });

    res.json({ message: "Payment details saved.", fashionHouse });
  } catch (err) {
    next(err);
  }
});

export default router;
