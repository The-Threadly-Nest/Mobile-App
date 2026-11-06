import { Inject, Injectable } from "@nestjs/common";
import type { PreferencesInput } from "./preferences.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { getPublicFileUrl, readStoredObject } from "../../lib/s3";

// Save / Upsert Customer Preference

// Get Customer Preference

@Injectable()
export class PreferencesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async post(input: PreferencesInput<"post">) {

    const userId = input.authUserId!;
    const { styles, budget, timeline, phone, location, photoKey, savedCatalogIds } = input.body;
    if (photoKey) {
      const prefix = input.authRole === "customer" ? `customers/${userId}/`
        : input.authFashionHouseId ? `houses/${input.authFashionHouseId}/` : null;
      if (!prefix || !photoKey.startsWith(prefix) || photoKey.includes("..") || !/^[a-zA-Z0-9/_.-]+\.webp$/.test(photoKey)) {
        return rejectRequest({ error: "Choose a photo uploaded by your account." }, 403);
      }
      const bytes = await readStoredObject(photoKey, 10 * 1024 * 1024);
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
        return rejectRequest({ error: "Please upload a supported profile image." }, 400);
      }
    }

    if (savedCatalogIds?.length) {
      const count = await this.database.client.catalogItem.count({ where: { id: { in: savedCatalogIds } } });
      if (count !== savedCatalogIds.length) return rejectRequest({ error: "Some saved items are no longer available. Please refresh and try again." }, 400);
    }

    const preference = await this.database.client.customerPreference.upsert({
      where: { userId },
      update: {
        ...(styles !== undefined && { styles }),
        ...(budget !== undefined && { budget }),
        ...(timeline !== undefined && { timeline }),
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location }),
        ...(photoKey !== undefined && { photoKey }),
        ...(savedCatalogIds !== undefined && { savedCatalogIds }),
      },
      create: {
        userId,
        styles: styles || [],
        budget: budget || "mid",
        timeline: timeline || "2-4 weeks",
        phone: phone || null,
        location: location || null,
        photoKey: photoKey || null,
        savedCatalogIds: savedCatalogIds || [],
      },
    });

    return this.present(preference);

  }

  async get(input: PreferencesInput<"get">) {

    const userId = input.authUserId!;
    const preference = await this.database.client.customerPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return rejectRequest({ error: "Preferences not set." }, 404);
    }

    return this.present(preference);

  }

  private async present(preference: { photoKey: string | null; savedCatalogIds: string[] }) {
    const savedItems = preference.savedCatalogIds.length ? await this.database.client.catalogItem.findMany({
      where: { id: { in: preference.savedCatalogIds } },
      select: { id: true, name: true, imageUrl: true, priceFrom: true, fashionHouseId: true },
    }) : [];
    return { ...preference, photoUrl: preference.photoKey ? getPublicFileUrl(preference.photoKey) : null, savedItems };
  }
}

