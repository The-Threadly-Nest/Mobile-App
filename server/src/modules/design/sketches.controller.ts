import { Controller, HttpCode, Inject, UseGuards, Get, Post } from "@nestjs/common";
import { SketchesService } from "./sketches.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { sketchesInputs, type SketchesInput } from "./sketches.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/sketches")
export class SketchesController {
  constructor(@Inject(SketchesService) private readonly service: SketchesService) { }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  get(@RequestInput(sketchesInputs.get) input: SketchesInput<"get">) {
    return this.service.get(input);
  }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(sketchesInputs.post) input: SketchesInput<"post">) {
    return this.service.post(input);
  }
}

