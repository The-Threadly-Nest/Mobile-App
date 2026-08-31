import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { adminOnboardingSchema } from "../schemas/admin.schema";

const router = Router();
router.use(requireAuth, requireRole("admin"));

// GET /api/admin/profile - Get Admin's fashion house & onboarding status
router.get("/profile", async (req, res, next) => {
  try {
    const fashionHouse = await prisma.fashionHouse.findUnique({
      where: { adminId: req.authUserId! },
      include: {
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
    const fashionHouse = await prisma.fashionHouse.findUnique({
      where: { adminId: req.authUserId! },
    });

    if (!fashionHouse) {
      return res.status(404).json({ error: "Fashion house profile not found." });
    }

    const updatedHouse = await prisma.fashionHouse.update({
      where: { id: fashionHouse.id },
      data: {
        ...req.body,
        onboardingCompleted: true,
      },
    });

    res.json({
      message: "Admin onboarding saved successfully.",
      fashionHouse: updatedHouse,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
