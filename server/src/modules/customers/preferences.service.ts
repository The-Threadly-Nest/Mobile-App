import { Inject, Injectable } from "@nestjs/common";
import type { PreferencesInput } from "./preferences.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

// Save / Upsert Customer Preference

// Get Customer Preference

@Injectable()
export class PreferencesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async post(input: PreferencesInput<"post">) {

    const userId = input.authUserId!;
    const { styles, budget, timeline, phone, location } = input.body;

    const existing = await this.database.client.customerPreference.findUnique({ where: { userId } });

    const preference = await this.database.client.customerPreference.upsert({
      where: { userId },
      update: {
        ...(styles !== undefined && { styles }),
        ...(budget !== undefined && { budget }),
        ...(timeline !== undefined && { timeline }),
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location }),
      },
      create: {
        userId,
        styles: styles || [],
        budget: budget || "mid",
        timeline: timeline || "2-4 weeks",
        phone: phone || null,
        location: location || null,
      },
    });

    return preference;

  }

  async get(input: PreferencesInput<"get">) {

    const userId = input.authUserId!;
    const preference = await this.database.client.customerPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      return rejectRequest({ error: "Preferences not set." }, 404);
    }

    return preference;

  }

}

