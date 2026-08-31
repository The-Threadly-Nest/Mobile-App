import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/fashion-houses — Public/Customer list of all onboarded fashion houses
router.get("/", async (req, res, next) => {
  try {
    const houses = await prisma.fashionHouse.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { email: true } },
        catalogItems: {
          orderBy: { priceFrom: "asc" },
        },
      },
    });

    const formatted = houses.map((fh) => {
      const categoriesList = (fh.categories as string[]) || [];
      const primaryCategory = categoriesList[0] || "Custom Tailoring";

      // Real Price calculation from uploaded catalog items!
      let priceDisplay = "Price on Request";
      if (fh.catalogItems && fh.catalogItems.length > 0) {
        const minPrice = fh.catalogItems[0].priceFrom;
        const symbol = fh.currency === "USD" ? "$" : "₦";
        priceDisplay = `From ${symbol} ${minPrice.toLocaleString()}`;
      }

      // Cover image: Use brand logo if available, else first uploaded catalog garment image, else default placeholder
      let coverImage = fh.brandLogoUrl;
      if (!coverImage && fh.catalogItems && fh.catalogItems.length > 0) {
        coverImage = fh.catalogItems[0].imageUrl;
      }
      if (!coverImage) {
        coverImage = "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=500&q=80";
      }

      return {
        id: fh.id,
        name: fh.shopName || "Luxury Atelier",
        location: fh.location || "Nigeria",
        price: priceDisplay,
        rating: 5.0,
        reviewsCount: fh.catalogItems?.length ? `${fh.catalogItems.length} items` : "New Atelier",
        badge: categoriesList.length > 0 ? categoriesList.slice(0, 2).join(" · ").toUpperCase() : "BESPOKE TAILORING",
        turnaround: "2-3 week turnaround",
        categoryTag: primaryCategory,
        image: coverImage,
        category: primaryCategory,
        bio: fh.bio || "",
        phone: fh.phone || "",
      };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// GET /api/fashion-houses/:id — Get single fashion house details
router.get("/:id", async (req, res, next) => {
  try {
    const fh = await prisma.fashionHouse.findUnique({
      where: { id: req.params.id },
      include: {
        catalogItems: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!fh) {
      return res.status(404).json({ error: "Fashion house not found." });
    }

    res.json(fh);
  } catch (err) {
    next(err);
  }
});

export default router;
