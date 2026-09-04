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
    const user = await prisma.user.findUnique({ where: { id: req.authUserId! } });
    if (!user) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }

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
    const updatedHouse = await prisma.fashionHouse.upsert({
      where: { adminId: req.authUserId! },
      create: {
        adminId: req.authUserId!,
        shopName: req.body.shopName || "My Fashion House",
        location: req.body.location,
        phone: req.body.phone,
        bio: req.body.bio,
        brandLogoUrl: req.body.brandLogoUrl,
        categories: req.body.categories || [],
        currency: req.body.currency || "NGN",
        onboardingCompleted: true,
      },
      update: {
        ...req.body,
        onboardingCompleted: true,
      },
    });

    res.json({
      message: "Admin profile and onboarding saved successfully.",
      fashionHouse: updatedHouse,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
