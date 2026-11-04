import { Controller, HttpCode, Inject, UseGuards, Get, Post } from "@nestjs/common";
import { StaffService } from "./staff.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { staffInputs, type StaffInput } from "./staff.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/staff")
export class StaffController {
  constructor(@Inject(StaffService) private readonly service: StaffService) { }

  @Get("me")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getMe(@RequestInput(staffInputs.getMe) input: StaffInput<"getMe">) {
    return this.service.getMe(input);
  }

  @Post("invite")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  postInvite(@RequestInput(staffInputs.postInvite) input: StaffInput<"postInvite">) {
    return this.service.postInvite(input);
  }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  get(@RequestInput(staffInputs.get) input: StaffInput<"get">) {
    return this.service.get(input);
  }

  @Post(":staffId/resend-activation")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  postByStaffIdResendActivation(@RequestInput(staffInputs.postByStaffIdResendActivation) input: StaffInput<"postByStaffIdResendActivation">) {
    return this.service.postByStaffIdResendActivation(input);
  }
}

