import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { CatalogInput } from "./catalog.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

import { type CollectionPagination } from "../../schemas/pagination.schema";
import { collectionWindow, collectionPage } from "../../lib/pagination";
import { validateCatalogOffering } from "../../lib/catalog-commerce";
import { serializeSlot } from "../../lib/availability";

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

  async getMeasurementSlots(input: CatalogInput<"getMeasurementSlots">) {
    const item = await this.database.client.catalogItem.findUnique({ where: { id: routeParam(input, "id") }, include: { fashionHouse: { select: { id: true, shopName: true, timezone: true } } } });
    if (!item) return rejectRequest({ error: "This item is no longer available." }, 404);
    if (item.fulfillmentType !== "custom_fit") return rejectRequest({ error: "This item is ready for pickup. Choose your size and add it to your cart." }, 400);
    const slots = await this.database.client.availableSlot.findMany({ where: { fashionHouseId: item.fashionHouseId, active: true, booked: false, booking: { is: null }, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 1000 });
    return { item: { id: item.id, name: item.name, imageUrl: item.imageUrl, fashionHouse: item.fashionHouse }, slots: slots.map(slot => serializeSlot(slot, item.fashionHouse.timezone)) };
  }

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
    const { name, description, category, sizes, colors, priceFrom, imageUrl, fulfillmentType } = input.body;
    validateCatalogOffering({ fulfillmentType, priceFrom: priceFrom ?? null, sizes: sizes ?? [] });

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
        fulfillmentType,
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
    validateCatalogOffering({ fulfillmentType: input.body.fulfillmentType ?? existing.fulfillmentType, priceFrom: priceFrom !== undefined ? priceFrom : existing.priceFrom, sizes: sizes ?? existing.sizes });
    const updated = await this.database.client.catalogItem.update({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
      data: {
        ...(name !== undefined && { name }),
        ...(input.body.fulfillmentType !== undefined && { fulfillmentType: input.body.fulfillmentType }),
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
      where: {
        ...(input.query.fulfillmentType ? { fulfillmentType: input.query.fulfillmentType } : {}),
        ...(input.query.q ? { OR: [
          { name: { contains: input.query.q, mode: "insensitive" as const } },
          { category: { contains: input.query.q, mode: "insensitive" as const } },
          { fashionHouse: { shopName: { contains: input.query.q, mode: "insensitive" as const } } },
        ] } : {}),
      },
      orderBy: input.query.sort === "price_asc" ? [{ priceFrom: "asc" }, { id: "desc" }] : input.query.sort === "price_desc" ? [{ priceFrom: "desc" }, { id: "desc" }] : [{ createdAt: "desc" }, { id: "desc" }],
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

