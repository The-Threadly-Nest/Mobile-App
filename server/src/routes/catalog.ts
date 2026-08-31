import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createCatalogItemSchema, updateCatalogItemSchema } from "../schemas/catalog.schema";

const router = Router();
router.use(requireAuth);

// List Catalog Items (All authenticated roles)
router.get("/", async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const catalog = await prisma.catalogItem.findMany({
      where: { fashionHouseId: fhId },
      orderBy: { createdAt: "desc" },
    });
    res.json(catalog);
  } catch (err) {
    next(err);
  }
});

// Create Catalog Item (Admin/Staff only)
router.post("/", requireRole("admin", "staff"), validate({ body: createCatalogItemSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { name, priceFrom, imageUrl } = req.body;

    const item = await prisma.catalogItem.create({
      data: {
        fashionHouseId: fhId,
        name,
        priceFrom,
        imageUrl,
      },
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// Update Catalog Item (Admin/Staff only)
router.patch("/:id", requireRole("admin", "staff"), validate({ body: updateCatalogItemSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);

    // Tenant Isolation: Verify item belongs to this tenant
    const existing = await prisma.catalogItem.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Catalog item not found." });
    }

    const { name, priceFrom, imageUrl } = req.body;
    const updated = await prisma.catalogItem.update({
      where: { id: req.params.id },
      data: { name, priceFrom, imageUrl },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete Catalog Item (Admin/Staff only)
router.delete("/:id", requireRole("admin", "staff"), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);

    const existing = await prisma.catalogItem.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Catalog item not found." });
    }

    await prisma.catalogItem.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Catalog item deleted successfully." });
  } catch (err) {
    next(err);
  }
});

// Public GET catalog items for a fashion house
router.get("/fashion-house/:fashionHouseId", async (req, res, next) => {
  try {
    const catalog = await prisma.catalogItem.findMany({
      where: { fashionHouseId: req.params.fashionHouseId },
      orderBy: { createdAt: "desc" },
    });
    res.json(catalog);
  } catch (err) {
    next(err);
  }
});

export default router;
