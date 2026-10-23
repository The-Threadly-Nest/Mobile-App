import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createAvailableSlotSchema, updateAvailableSlotSchema } from "../schemas/slots.schema";
import { isUniqueConstraintError } from "../lib/idempotency";

const router = Router();
router.use(requireAuth);

// List Available Slots (Admin/Staff only)
router.get("/", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const slots = await prisma.availableSlot.findMany({
      where: { fashionHouseId: fhId },
      orderBy: [
        { date: "asc" },
        { time: "asc" },
      ],
    });
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

// Create Available Slot (Admin/Staff only)
router.post("/", requireRole("admin", "staff"), validate({ body: createAvailableSlotSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { date, time } = req.body;

    // Check if slot already exists for this fashion house (avoid duplicates on same date/time)
    const existing = await prisma.availableSlot.findFirst({
      where: { fashionHouseId: fhId, date, time },
    });
    if (existing) {
      return res.status(409).json({ error: "A slot at this date and time already exists." });
    }

    let slot;
    try {
      slot = await prisma.availableSlot.create({
        data: {
          fashionHouseId: fhId,
          date,
          time,
          booked: false,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "A slot at this date and time already exists." });
      }
      throw error;
    }

    res.status(201).json(slot);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A slot at this date and time already exists." });
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

    const { date, time, booked } = req.body;
    const linkedBooking = await prisma.booking.findUnique({
      where: { availableSlotId: existing.id },
      select: { id: true },
    });

    if (linkedBooking && (date !== undefined || time !== undefined || booked === false)) {
      return res.status(409).json({
        error: "A booked fitting slot cannot be moved or reopened. Cancel the booking first.",
      });
    }

    // If date/time are being changed, check for conflict
    if (date || time) {
      const conflict = await prisma.availableSlot.findFirst({
        where: {
          fashionHouseId: fhId,
          date: date ?? existing.date,
          time: time ?? existing.time,
          NOT: { id: req.params.id },
        },
      });
      if (conflict) {
        return res.status(400).json({ error: "A slot at this date and time already exists." });
      }
    }

    if (booked === true && !existing.booked) {
      const result = await prisma.availableSlot.updateMany({
        where: { id: req.params.id, fashionHouseId: fhId, booked: false },
        data: {
          booked: true,
          ...(date !== undefined ? { date } : {}),
          ...(time !== undefined ? { time } : {}),
        },
      });

      if (result.count === 0) {
        return res.status(409).json({ error: "This slot was just booked by someone else. Please choose another." });
      }

      const updated = await prisma.availableSlot.findUnique({ where: { id: req.params.id } });
      return res.json(updated);
    }

    let updated;
    try {
      updated = await prisma.availableSlot.update({
        where: { id: req.params.id, fashionHouseId: fhId },
        data: {
          date: date !== undefined ? date : existing.date,
          time: time !== undefined ? time : existing.time,
          booked: booked !== undefined ? booked : existing.booked,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(409).json({ error: "A slot at this date and time already exists." });
      }
      throw error;
    }

    res.json(updated);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: "A slot at this date and time already exists." });
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
