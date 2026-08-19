import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { createSketchSchema } from "@/schemas/sketch.schema";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

async function getOwnFashionHouseId(userId: string, role: string) {
  if (role === "admin") {
    const admin = await prisma.user.findUnique({ where: { id: userId }, include: { fashionHouseOwned: true } });
    if (!admin || !admin.fashionHouseOwned) {
      throw Object.assign(new Error("Fashion house not found for this admin"), { status: 404 });
    }
    return admin.fashionHouseOwned.id;
  } else {
    const staff = await prisma.user.findUnique({ where: { id: userId } });
    if (!staff || !staff.fashionHouseId) {
      throw Object.assign(new Error("Fashion house not found for this staff member"), { status: 404 });
    }
    return staff.fashionHouseId;
  }
}

router.get("/", async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const sketches = await prisma.sketch.findMany({
      where: { fashionHouseId: fhId },
      orderBy: { createdAt: "desc" },
    });
    res.json(sketches);
  } catch (err) {
    next(err);
  }
});

router.post("/", validate({ body: createSketchSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { title, imageUrl } = req.body;
    const sketch = await prisma.sketch.create({
      data: {
        fashionHouseId: fhId,
        title,
        imageUrl,
      },
    });
    res.status(201).json(sketch);
  } catch (err) {
    next(err);
  }
});

export default router;
