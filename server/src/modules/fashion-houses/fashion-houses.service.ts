import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { FashionHousesInput } from "./fashion-houses.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { type CollectionPagination } from "../../schemas/pagination.schema";
import { collectionWindow, collectionPage } from "../../lib/pagination";

// GET /api/fashion-houses — Public/Customer list of all onboarded fashion houses

// GET /api/fashion-houses/:id — Get single fashion house details

@Injectable()
export class FashionHousesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async get(input: FashionHousesInput<"get">) {

    const { page, limit } = input.query as unknown as CollectionPagination;
    const houses = await this.database.client.fashionHouse.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
      include: {
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

    return collectionPage(formatted, page, limit);

  }

  async getById(input: FashionHousesInput<"getById">) {

    const fh = await this.database.client.fashionHouse.findUnique({
      where: { id: routeParam(input, "id") },
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
      return rejectRequest({ error: "Fashion house not found." }, 404);
    }

    const ordersCount = fh._count?.orders ?? 0;
    return { ...fh, ordersCount };

  }

}

