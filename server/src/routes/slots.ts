import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createAvailableSlotSchema, updateAvailableSlotSchema } from "../schemas/slots.schema";
import { isUniqueConstraintError } from "../lib/idempotency";
import { isAvailabilityConflictError, serializeSlot, slotsOverlap, zonedDateTimeToUtc } from "../lib/availability";

const router = Router();
router.use(requireAuth);

// List Available Slots (Admin/Staff only)
router.get("/", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const fashionHouse = await prisma.fashionHouse.findUniqueOrThrow({
      where: { id: fhId }, select: { timezone: true },
    });
    const slots = await prisma.availableSlot.findMany({
      where: { fashionHouseId: fhId, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    res.json(slots.map((slot) => serializeSlot(slot, fashionHouse.timezone)));
  } catch (err) {
    next(err);
  }
});

// Create Available Slot (Admin/Staff only)
router.post("/", requireRole("admin", "staff"), validate({ body: createAvailableSlotSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { date, time } = req.body;
    const fashionHouse = await prisma.fashionHouse.findUniqueOrThrow({
      where: { id: fhId }, select: { timezone: true, slotDurationMinutes: true },
    });
    const durationMinutes = req.body.durationMinutes ?? fashionHouse.slotDurationMinutes;
    const startsAt = zonedDateTimeToUtc(date, time, fashionHouse.timezone);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    if (startsAt <= new Date()) {
      return res.status(400).json({ error: "Fitting slots must be scheduled in the future." });
    }

    const possibleConflicts = await prisma.availableSlot.findMany({
      where: {
        fashionHouseId: fhId,
        active: true,
        startsAt: {
          gte: new Date(startsAt.getTime() - 8 * 60 * 60_000),
          lt: new Date(startsAt.getTime() + durationMinutes * 60_000),
        },
      },
      select: { startsAt: true, durationMinutes: true },
    });
    if (possibleConflicts.some((slot) => slotsOverlap(startsAt, durationMinutes, slot))) {
      return res.status(409).json({ error: "This fitting time overlaps another active slot." });
    }

    let slot;
    try {
      slot = await prisma.availableSlot.create({
        data: {
          fashionHouseId: fhId,
          date,
          time,
          startsAt,
          endsAt,
          durationMinutes,
          active: true,
          booked: false,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) || isAvailabilityConflictError(error)) {
        return res.status(409).json({ error: "This fitting time overlaps another active slot." });
      }
      throw error;
    }

    res.status(201).json(serializeSlot(slot, fashionHouse.timezone));
  } catch (err) {
    if (isUniqueConstraintError(err) || isAvailabilityConflictError(err)) {
      return res.status(409).json({ error: "This fitting time overlaps another active slot." });
    }
    next(err);
  }
});

// Update Available Slot (Admin/Staff only)
router.patch("/:id", requireRole("admin", "staff"), validate({ body: updateAvailableSlotSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);

    // Tenant Isolation: Verify slot belongs to this tenant
    const existing = await prisma.availableSlot.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Slot not found." });
    }

    const fashionHouse = await prisma.fashionHouse.findUniqueOrThrow({
      where: { id: fhId }, select: { timezone: true, slotDurationMinutes: true },
    });
    const { date, time, booked, active } = req.body;
    const targetDate = date ?? existing.date;
    const targetTime = time ?? existing.time;
    const durationMinutes = req.body.durationMinutes ?? existing.durationMinutes ?? fashionHouse.slotDurationMinutes;
    const startsAt = date !== undefined || time !== undefined || !existing.startsAt
      ? zonedDateTimeToUtc(targetDate, targetTime, fashionHouse.timezone)
      : existing.startsAt;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    if (startsAt <= new Date()) {
      return res.status(400).json({ error: "Fitting slots must be scheduled in the future." });
    }
    const linkedBooking = await prisma.booking.findUnique({
      where: { availableSlotId: existing.id },
      select: { id: true },
    });

    if (linkedBooking && (date !== undefined || time !== undefined || req.body.durationMinutes !== undefined || booked === false || active === false)) {
      return res.status(409).json({
        error: "A booked fitting slot cannot be moved or reopened. Cancel the booking first.",
      });
    }

    if (date !== undefined || time !== undefined || req.body.durationMinutes !== undefined || active === true) {
      const possibleConflicts = await prisma.availableSlot.findMany({
        where: {
          fashionHouseId: fhId,
          active: true,
          startsAt: {
            gte: new Date(startsAt.getTime() - 8 * 60 * 60_000),
            lt: new Date(startsAt.getTime() + durationMinutes * 60_000),
          },
          NOT: { id: req.params.id },
        },
        select: { startsAt: true, durationMinutes: true },
      });
      if (possibleConflicts.some((slot) => slotsOverlap(startsAt, durationMinutes, slot))) {
        return res.status(409).json({ error: "This fitting time overlaps another active slot." });
      }
    }

    if (booked === true && !existing.booked) {
      const result = await prisma.availableSlot.updateMany({
        where: { id: req.params.id, fashionHouseId: fhId, booked: false },
        data: {
          booked: true,
          ...(date !== undefined ? { date } : {}),
          ...(time !== undefined ? { time } : {}),
          startsAt,
          endsAt,
          durationMinutes,
          ...(active !== undefined ? { active } : {}),
        },
      });

      if (result.count === 0) {
        return res.status(409).json({ error: "This slot was just booked by someone else. Please choose another." });
      }

      const updated = await prisma.availableSlot.findUnique({ where: { id: req.params.id } });
      return res.json(updated ? serializeSlot(updated, fashionHouse.timezone) : updated);
    }

    let updated;
    try {
      updated = await prisma.availableSlot.update({
        where: { id: req.params.id, fashionHouseId: fhId },
        data: {
          date: date !== undefined ? date : existing.date,
          time: time !== undefined ? time : existing.time,
          startsAt,
          endsAt,
          durationMinutes,
          active: active !== undefined ? active : existing.active,
          booked: booked !== undefined ? booked : existing.booked,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error) || isAvailabilityConflictError(error)) {
        return res.status(409).json({ error: "This fitting time overlaps another active slot." });
      }
      throw error;
    }

    res.json(serializeSlot(updated, fashionHouse.timezone));
  } catch (err) {
    if (isUniqueConstraintError(err) || isAvailabilityConflictError(err)) {
      return res.status(409).json({ error: "This fitting time overlaps another active slot." });
    }
    next(err);
  }
});

// Delete Available Slot (Admin/Staff only)
router.delete("/:id", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);

    // Tenant Isolation: Verify slot belongs to this tenant
    const existing = await prisma.availableSlot.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Slot not found." });
    }

    const linkedBooking = await prisma.booking.findUnique({
      where: { availableSlotId: existing.id },
      select: { id: true },
    });
    if (linkedBooking) {
      return res.status(409).json({ error: "A slot with a booking cannot be deleted. Cancel the booking first." });
    }

    await prisma.availableSlot.delete({
      where: { id: req.params.id, fashionHouseId: fhId },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
