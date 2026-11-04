import { Inject, Injectable } from "@nestjs/common";
import type { SketchesInput } from "./sketches.dto";
import { result } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

@Injectable()
export class SketchesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async get(input: SketchesInput<"get">) {

    const fhId = getOwnFashionHouseId(input);
    const sketches = await this.database.client.sketch.findMany({
      where: { fashionHouseId: fhId },
      orderBy: { createdAt: "desc" },
    });
    return sketches;

  }

  async post(input: SketchesInput<"post">) {

    const fhId = getOwnFashionHouseId(input);
    const { title, imageUrl } = input.body;
    const sketch = await this.database.client.sketch.create({
      data: {
        fashionHouseId: fhId,
        title,
        imageUrl,
      },
    });
    return result(sketch, 201);

  }

}

