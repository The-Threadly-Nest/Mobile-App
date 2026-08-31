import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { preferenceSchema } from "../schemas/preferences.schema";

const router = Router();
router.use(requireAuth);

// Save / Upsert Customer Preference
router.post("/", validate({ body: preferenceSchema }), async (req, res, next) => {
  try {
    const userId = req.authUserId!;
    const { styles, budget, timeline, phone, location } = req.body;

    const existing = await prisma.customerPreference.findUnique({ where: { userId } });

    const preference = await prisma.customerPreference.upsert({
      where: { userId },
      update: {
        ...(styles !== undefined && { styles }),
        ...(budget !== undefined && { budget }),
        ...(timeline !== undefined && { timeline }),
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location }),
      },
      create: {
        userId,
        styles: styles || [],
        budget: budget || "mid",
        timeline: timeline || "2-4 weeks",
        phone: phone || null,
        location: location || null,
      },
    });

    res.json(preference);
  } catch (err) {
    next(err);
  }
});

// Get Customer Preference
router.get("/", async (req, res, next) => {
  try {
    const userId = req.authUserId!;
    const preference = await prisma.customerPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return res.status(404).json({ error: "Preferences not set." });
    }

    res.json(preference);
  } catch (err) {
    next(err);
  }
});

export default router;
