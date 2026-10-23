import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { adminOnboardingSchema, paymentDetailsSchema } from "../schemas/admin.schema";

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
        availableSlots: {
          orderBy: [{ date: "asc" }, { time: "asc" }],
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

      // Onboarding owns the house's unbooked schedule. Existing booked slots
      // stay intact so an established appointment can never be erased here.
      await tx.availableSlot.deleteMany({
        where: {
          fashionHouseId: fashionHouse.id,
          booked: false,
        },
      });

      await tx.availableSlot.createMany({
        data: availableSlots.map((slot: { date: string; time: string }) => ({
          fashionHouseId: fashionHouse.id,
          date: slot.date,
          time: slot.time,
          booked: false,
        })),
        skipDuplicates: true,
      });

      return tx.fashionHouse.findUniqueOrThrow({
        where: { id: fashionHouse.id },
        include: {
          availableSlots: {
            orderBy: [{ date: "asc" }, { time: "asc" }],
          },
        },
      });
    });

    res.json({
      message: "Admin profile and onboarding saved successfully.",
      fashionHouse: updatedHouse,
    });
  } catch (err) {
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
