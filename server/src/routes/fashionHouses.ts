import { Router } from "express";
import { prisma } from "../lib/prisma";
import { validate } from "../middleware/validate";
import { collectionPaginationSchema, type CollectionPagination } from "../schemas/pagination.schema";
import { collectionWindow, sendCollectionPage } from "../lib/pagination";
import { idParamSchema } from "../schemas/params.schema";

const router = Router();

// GET /api/fashion-houses — Public/Customer list of all onboarded fashion houses
router.get("/", validate({ query: collectionPaginationSchema }), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as CollectionPagination;
    const houses = await prisma.fashionHouse.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
      include: {
        admin: { select: { email: true } },
        _count: { select: { catalogItems: true } },
        catalogItems: {
          orderBy: { priceFrom: "asc" },
          take: 1, // Only the cheapest item is used for priceDisplay and coverImage
        },
      },
    });

    const formatted = houses.map((fh) => {
      const categoriesList = (fh.categories as string[]) || [];
      const primaryCategory = categoriesList[0] || "Custom Tailoring";

      // Real Price calculation from uploaded catalog items!
      // Real Price calculation from uploaded catalog items!
      let priceDisplay = "Price on Request";
      if (fh.catalogItems && fh.catalogItems.length > 0) {
        const minPrice = fh.catalogItems[0].priceFrom;
        if (minPrice !== null && minPrice !== undefined) {
          const symbol = fh.currency === "USD" ? "$" : "₦";
          priceDisplay = `From ${symbol} ${minPrice.toLocaleString()}`;
        }
      }


      // Only return media uploaded by this fashion house.
      let coverImage = fh.brandLogoUrl;
      if (!coverImage && fh.catalogItems && fh.catalogItems.length > 0) {
        coverImage = fh.catalogItems[0].imageUrl;
      }

      return {
        id: fh.id,
        name: fh.shopName || "Luxury Atelier",
        location: fh.location || "Nigeria",
        price: priceDisplay,
        rating: 0,
        reviewsCount: 0,
        badge: categoriesList.length > 0 ? categoriesList.slice(0, 2).join(" · ").toUpperCase() : "BESPOKE TAILORING",
        turnaround: "Contact for timeline",
        categoryTag: primaryCategory,
        image: coverImage,
        category: primaryCategory,
        bio: fh.bio || "",
        phone: fh.phone || "",
      };
    });

    sendCollectionPage(res, formatted, page, limit);
  } catch (err) {
    next(err);
  }
});

// GET /api/fashion-houses/:id — Get single fashion house details
router.get("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const fh = await prisma.fashionHouse.findUnique({
      where: { id: req.params.id },
      include: {
        catalogItems: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!fh) {
      return res.status(404).json({ error: "Fashion house not found." });
    }

    const ordersCount = fh._count?.orders ?? 0;
    res.json({ ...fh, ordersCount });
  } catch (err) {
    next(err);
  }
});

export default router;
