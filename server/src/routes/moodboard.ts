import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createMoodBoardSketchSchema, promoteSketchSchema } from "../schemas/moodboard.schema";

const router = Router();
router.use(requireAuth);

/**
 * Helper to validate image URLs server-side
 */
function isValidImageUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// 1. Admin & Staff: Create a new mood board sketch
router.post("/", requireRole("admin", "staff"), validate({ body: createMoodBoardSketchSchema }), async (req, res, next) => {
  try {
    const { title, imageUrl } = req.body;

    if (!isValidImageUrl(imageUrl)) {
      return res.status(400).json({ error: "Invalid image URL provided." });
    }

    const sketch = await prisma.moodBoardSketch.create({
      data: {
        staffId: req.authUserId!,
        title: title.trim(),
        imageUrl,
      },
    });

    res.status(201).json(sketch);
  } catch (err) {
    next(err);
  }
});

// 2. Admin & Staff: List own sketches
router.get("/", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const sketches = await prisma.moodBoardSketch.findMany({
      where: { staffId: req.authUserId! },
      orderBy: { createdAt: "desc" },
    });
    res.json(sketches);
  } catch (err) {
    next(err);
  }
});

// 3. Admin & Staff: Delete own sketch
router.delete("/:id", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.moodBoardSketch.findFirst({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: "Sketch not found" });
    }

    await prisma.moodBoardSketch.delete({
      where: { id },
    });

    res.json({ message: "Sketch deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// 4. Admin ONLY: View a specific staff member's mood board
router.get("/staff/:staffId", requireRole("admin"), async (req, res, next) => {
  try {
    const { staffId } = req.params;

    const adminFashionHouseId = await getOwnFashionHouseId(req.authUserId!, "admin");

    // Verify target staff member belongs to the admin's fashion house
    const staffUser = await prisma.user.findUnique({
      where: { id: staffId },
    });

    if (!staffUser || staffUser.fashionHouseId !== adminFashionHouseId) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const sketches = await prisma.moodBoardSketch.findMany({
      where: { staffId },
      orderBy: { createdAt: "desc" },
    });

    res.json(sketches);
  } catch (err) {
    next(err);
  }
});

// 5. Admin ONLY: Promote a sketch into public CatalogItem
router.post("/:id/promote", requireRole("admin"), validate({ body: promoteSketchSchema }), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { priceFrom, name } = req.body;

    const adminFashionHouseId = await getOwnFashionHouseId(req.authUserId!, "admin");

    // Fetch sketch
    const sketch = await prisma.moodBoardSketch.findUnique({
      where: { id },
    });

    if (!sketch) {
      return res.status(404).json({ error: "Sketch not found" });
    }

    // Execute promotion atomically in a transaction
    const [catalogItem, updatedSketch] = await prisma.$transaction([
      prisma.catalogItem.create({
        data: {
          fashionHouseId: adminFashionHouseId,
          name: name?.trim() || sketch.title,
          priceFrom: priceFrom ?? 0,
          imageUrl: sketch.imageUrl,
        },
      }),
      prisma.moodBoardSketch.update({
        where: { id: sketch.id },
        data: { promotedToCatalog: true },
      }),
    ]);

    res.status(201).json({
      message: "Sketch promoted to catalog successfully",
      catalogItem,
      sketch: updatedSketch,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
