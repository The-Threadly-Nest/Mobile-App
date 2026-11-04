import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { MoodboardInput } from "./moodboard.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { moodboardAccessWhere } from "../../lib/authorization";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

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

// 2. Admin & Staff: List own sketches

// 3. Admin & Staff: Delete own sketch

// 4. Admin ONLY: View a specific staff member's mood board

// 5. Admin ONLY: Promote a sketch into public CatalogItem

@Injectable()
export class MoodboardService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async post(input: MoodboardInput<"post">) {

    const { title, imageUrl } = input.body;

    if (!isValidImageUrl(imageUrl)) {
      return rejectRequest({ error: "We couldn't open that image. Please select it again." }, 400);
    }

    const sketch = await this.database.client.moodBoardSketch.create({
      data: {
        staffId: input.authUserId!,
        title: title.trim(),
        imageUrl,
      },
    });

    return result(sketch, 201);

  }

  async get(input: MoodboardInput<"get">) {

    const sketches = await this.database.client.moodBoardSketch.findMany({
      where: { staffId: input.authUserId! },
      orderBy: { createdAt: "desc" },
    });
    return sketches;

  }

  async deleteById(input: MoodboardInput<"deleteById">) {

    const id = routeParam(input, "id");

    const existing = await this.database.client.moodBoardSketch.findFirst({
      where: { id, staffId: input.authUserId! },
    });

    if (!existing) {
      return rejectRequest({ error: "Sketch not found or you do not have permission to delete it." }, 404);
    }

    await this.database.client.moodBoardSketch.delete({
      where: { id },
    });

    return { message: "Sketch deleted successfully" };

  }

  async getStaffByStaffId(input: MoodboardInput<"getStaffByStaffId">) {

    const staffId = routeParam(input, "staffId");

    const adminFashionHouseId = getOwnFashionHouseId(input);

    // Verify target staff member belongs to the admin's fashion house
    const staffUser = await this.database.client.user.findFirst({
      where: { id: staffId, role: "staff", fashionHouseId: adminFashionHouseId },
    });

    if (!staffUser || staffUser.fashionHouseId !== adminFashionHouseId) {
      return rejectRequest({ error: "Staff member not found" }, 404);
    }

    const sketches = await this.database.client.moodBoardSketch.findMany({
      where: { staffId },
      orderBy: { createdAt: "desc" },
    });

    return sketches;

  }

  async postByIdPromote(input: MoodboardInput<"postByIdPromote">) {

    const id = routeParam(input, "id");
    const { priceFrom, name } = input.body;

    const adminFashionHouseId = getOwnFashionHouseId(input);

    // Fetch sketch
    const sketch = await this.database.client.moodBoardSketch.findFirst({
      where: { id, ...moodboardAccessWhere(input) },
    });

    if (!sketch) {
      return rejectRequest({ error: "Sketch not found" }, 404);
    }

    // Execute promotion atomically in a transaction
    const [catalogItem, updatedSketch] = await this.database.client.$transaction(async (transaction) => {
      const catalogItem = await transaction.catalogItem.create({
        data: {
          fashionHouseId: adminFashionHouseId,
          name: name?.trim() || sketch.title,
          priceFrom: priceFrom ?? 0,
          imageUrl: sketch.imageUrl,
        },
      });
      const updatedSketch = await transaction.moodBoardSketch.update({
        where: { id: sketch.id },
        data: { promotedToCatalog: true },
      });
      return [catalogItem, updatedSketch] as const;
    });

    return result({
      message: "Sketch promoted to catalog successfully",
      catalogItem,
      sketch: updatedSketch,
    }, 201);

  }

}

