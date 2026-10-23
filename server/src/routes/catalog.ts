import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createCatalogItemSchema, updateCatalogItemSchema } from "../schemas/catalog.schema";
import { collectionPaginationSchema, type CollectionPagination } from "../schemas/pagination.schema";
import { collectionWindow, sendCollectionPage } from "../lib/pagination";
import { fashionHouseIdParamSchema, idParamSchema } from "../schemas/params.schema";

const router = Router();
router.use(requireAuth);

// List Catalog Items (All authenticated roles)
router.get("/", validate({ query: collectionPaginationSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { page, limit } = req.query as unknown as CollectionPagination;
    const catalog = await prisma.catalogItem.findMany({
      where: { fashionHouseId: fhId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
    });
    sendCollectionPage(res, catalog, page, limit);
  } catch (err) {
    next(err);
  }
});

// Create Catalog Item (Admin/Staff only)
router.post("/", requireRole("admin", "staff"), validate({ body: createCatalogItemSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { name, description, category, sizes, colors, priceFrom, imageUrl } = req.body;

    const item = await prisma.catalogItem.create({
      data: {
        fashionHouseId: fhId,
        name,
        description: description ?? null,
        category: category ?? null,
        sizes: sizes ?? [],
        colors: colors ?? [],
        priceFrom: priceFrom ?? null,
        imageUrl,
      },
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// Update Catalog Item (Admin/Staff only)
router.patch("/:id", requireRole("admin", "staff"), validate({ params: idParamSchema, body: updateCatalogItemSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);

    // Tenant Isolation: Verify item belongs to this tenant
    const existing = await prisma.catalogItem.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Catalog item not found." });
    }

    const { name, description, category, sizes, colors, priceFrom, imageUrl } = req.body;
    const updated = await prisma.catalogItem.update({
      where: { id: req.params.id, fashionHouseId: fhId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(sizes !== undefined && { sizes }),
        ...(colors !== undefined && { colors }),
        ...(priceFrom !== undefined ? { priceFrom } : { priceFrom: existing.priceFrom }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete Catalog Item (Admin/Staff only)
router.delete("/:id", requireRole("admin", "staff"), validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);

    const existing = await prisma.catalogItem.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });
    if (!existing) {
      return res.status(404).json({ error: "Catalog item not found." });
    }

    await prisma.catalogItem.delete({
      where: { id: req.params.id, fashionHouseId: fhId },
    });

    res.json({ message: "Catalog item deleted successfully." });
  } catch (err) {
    next(err);
  }
});

// Public/Customer GET all marketplace catalog items across fashion houses
router.get("/marketplace", validate({ query: collectionPaginationSchema }), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as CollectionPagination;
    const items = await prisma.catalogItem.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, location: true, brandLogoUrl: true },
        },
      },
    });
    sendCollectionPage(res, items, page, limit);
  } catch (err) {
    next(err);
  }
});

// Public GET catalog items for a fashion house
router.get("/fashion-house/:fashionHouseId", validate({ params: fashionHouseIdParamSchema, query: collectionPaginationSchema }), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as CollectionPagination;
    const catalog = await prisma.catalogItem.findMany({
      where: { fashionHouseId: req.params.fashionHouseId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
    });
    sendCollectionPage(res, catalog, page, limit);
  } catch (err) {
    next(err);
  }
});

// Public GET single catalog item by ID with fashion house details
router.get("/item/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const item = await prisma.catalogItem.findUnique({
      where: { id: req.params.id },
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, location: true, brandLogoUrl: true, bio: true, phone: true },
        },
      },
    });
    if (!item) {
      return res.status(404).json({ error: "Catalog item not found." });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

export default router;
