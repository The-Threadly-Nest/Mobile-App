import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createAvailableSlotSchema, updateAvailableSlotSchema } from "../schemas/slots.schema";

const router = Router();
router.use(requireAuth);

// List Available Slots (Admin/Staff only)
router.get("/", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
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
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { date, time, booked } = req.body;

    // Check if slot already exists for this fashion house (avoid duplicates on same date/time)
    const existing = await prisma.availableSlot.findFirst({
      where: { fashionHouseId: fhId, date, time },
    });
    if (existing) {
      return res.status(400).json({ error: "A slot at this date and time already exists." });
    }

    const slot = await prisma.availableSlot.create({
      data: {
        fashionHouseId: fhId,
        date,
        time,
        booked: booked ?? false,
      },
    });

    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
});

// Update Available Slot (Admin/Staff only)
router.patch("/:id", requireRole("admin", "staff"), validate({ body: updateAvailableSlotSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);

    // Tenant Isolation: Verify slot belongs to this tenant
    const existing = await prisma.availableSlot.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Slot not found." });
    }

    const { date, time, booked } = req.body;

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

    const updated = await prisma.availableSlot.update({
      where: { id: req.params.id },
      data: {
        date: date !== undefined ? date : existing.date,
        time: time !== undefined ? time : existing.time,
        booked: booked !== undefined ? booked : existing.booked,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete Available Slot (Admin/Staff only)
router.delete("/:id", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);

    // Tenant Isolation: Verify slot belongs to this tenant
    const existing = await prisma.availableSlot.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Slot not found." });
    }

    await prisma.availableSlot.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
