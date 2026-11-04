import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { CatalogInput } from "./catalog.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

import { type CollectionPagination } from "../../schemas/pagination.schema";
import { collectionWindow, collectionPage } from "../../lib/pagination";

// List Catalog Items (All authenticated roles)

// Create Catalog Item (Admin/Staff only)

// Update Catalog Item (Admin/Staff only)

// Delete Catalog Item (Admin/Staff only)

// Public/Customer GET all marketplace catalog items across fashion houses

// Public GET catalog items for a fashion house

// Public GET single catalog item by ID with fashion house details

@Injectable()
export class CatalogService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async get(input: CatalogInput<"get">) {

    const fhId = getOwnFashionHouseId(input);
    const { page, limit } = input.query as unknown as CollectionPagination;
    const catalog = await this.database.client.catalogItem.findMany({
      where: { fashionHouseId: fhId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
    });
    return collectionPage(catalog, page, limit);

  }

  async post(input: CatalogInput<"post">) {

    const fhId = getOwnFashionHouseId(input);
    const { name, description, category, sizes, colors, priceFrom, imageUrl } = input.body;

    const item = await this.database.client.catalogItem.create({
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

    return result(item, 201);

  }

  async patchById(input: CatalogInput<"patchById">) {

    const fhId = getOwnFashionHouseId(input);

    // Tenant Isolation: Verify item belongs to this tenant
    const existing = await this.database.client.catalogItem.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });
    if (!existing) {
      return rejectRequest({ error: "Catalog item not found." }, 404);
    }

    const { name, description, category, sizes, colors, priceFrom, imageUrl } = input.body;
    const updated = await this.database.client.catalogItem.update({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
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

    return updated;

  }

  async deleteById(input: CatalogInput<"deleteById">) {

    const fhId = getOwnFashionHouseId(input);

    const existing = await this.database.client.catalogItem.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });
    if (!existing) {
      return rejectRequest({ error: "Catalog item not found." }, 404);
    }

    await this.database.client.catalogItem.delete({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });

    return { message: "Catalog item deleted successfully." };

  }

  async getMarketplace(input: CatalogInput<"getMarketplace">) {

    const { page, limit } = input.query as unknown as CollectionPagination;
    const items = await this.database.client.catalogItem.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, location: true, brandLogoUrl: true },
        },
      },
    });
    return collectionPage(items, page, limit);

  }

  async getFashionHouseByFashionHouseId(input: CatalogInput<"getFashionHouseByFashionHouseId">) {

    const { page, limit } = input.query as unknown as CollectionPagination;
    const catalog = await this.database.client.catalogItem.findMany({
      where: { fashionHouseId: routeParam(input, "fashionHouseId") },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...collectionWindow(page, limit),
    });
    return collectionPage(catalog, page, limit);

  }

  async getItemById(input: CatalogInput<"getItemById">) {

    const item = await this.database.client.catalogItem.findUnique({
      where: { id: routeParam(input, "id") },
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, location: true, brandLogoUrl: true, bio: true, phone: true },
        },
      },
    });
    if (!item) {
      return rejectRequest({ error: "Catalog item not found." }, 404);
    }
    return item;

  }

}

