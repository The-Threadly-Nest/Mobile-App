import { Controller, HttpCode, Inject, UseGuards, Get, Post, Patch, Delete } from "@nestjs/common";
import { SlotsService } from "./slots.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { slotsInputs, type SlotsInput } from "./slots.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/slots")
export class SlotsController {
  constructor(@Inject(SlotsService) private readonly service: SlotsService) { }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  get(@RequestInput(slotsInputs.get) input: SlotsInput<"get">) {
    return this.service.get(input);
  }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(slotsInputs.post) input: SlotsInput<"post">) {
    return this.service.post(input);
  }

  @Patch(":id")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  patchById(@RequestInput(slotsInputs.patchById) input: SlotsInput<"patchById">) {
    return this.service.patchById(input);
  }

  @Delete(":id")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  deleteById(@RequestInput(slotsInputs.deleteById) input: SlotsInput<"deleteById">) {
    return this.service.deleteById(input);
  }
}

