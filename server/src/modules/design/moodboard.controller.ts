import { Controller, HttpCode, Inject, UseGuards, Post, Get, Delete } from "@nestjs/common";
import { MoodboardService } from "./moodboard.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { moodboardInputs, type MoodboardInput } from "./moodboard.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/moodboard")
export class MoodboardController {
  constructor(@Inject(MoodboardService) private readonly service: MoodboardService) { }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(moodboardInputs.post) input: MoodboardInput<"post">) {
    return this.service.post(input);
  }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  get(@RequestInput(moodboardInputs.get) input: MoodboardInput<"get">) {
    return this.service.get(input);
  }

  @Delete(":id")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  deleteById(@RequestInput(moodboardInputs.deleteById) input: MoodboardInput<"deleteById">) {
    return this.service.deleteById(input);
  }

  @Get("staff/:staffId")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  getStaffByStaffId(@RequestInput(moodboardInputs.getStaffByStaffId) input: MoodboardInput<"getStaffByStaffId">) {
    return this.service.getStaffByStaffId(input);
  }

  @Post(":id/promote")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  postByIdPromote(@RequestInput(moodboardInputs.postByIdPromote) input: MoodboardInput<"postByIdPromote">) {
    return this.service.postByIdPromote(input);
  }
}

