import { Controller, HttpCode, Inject, UseGuards, Get, Patch, Post } from "@nestjs/common";
import { EscalationsService } from "./escalations.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { escalationsInputs, type EscalationsInput } from "./escalations.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/escalations")
export class EscalationsController {
  constructor(@Inject(EscalationsService) private readonly service: EscalationsService) { }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  get(@RequestInput(escalationsInputs.get) input: EscalationsInput<"get">) {
    return this.service.get(input);
  }

  @Get(":escalationId")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  getByEscalationId(@RequestInput(escalationsInputs.getByEscalationId) input: EscalationsInput<"getByEscalationId">) {
    return this.service.getByEscalationId(input);
  }

  @Patch(":escalationId/resolve")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  patchByEscalationIdResolve(@RequestInput(escalationsInputs.patchByEscalationIdResolve) input: EscalationsInput<"patchByEscalationIdResolve">) {
    return this.service.patchByEscalationIdResolve(input);
  }

  @Patch(":escalationId/decline")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  patchByEscalationIdDecline(@RequestInput(escalationsInputs.patchByEscalationIdDecline) input: EscalationsInput<"patchByEscalationIdDecline">) {
    return this.service.patchByEscalationIdDecline(input);
  }

  @Post("assign")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  postAssign(@RequestInput(escalationsInputs.postAssign) input: EscalationsInput<"postAssign">) {
    return this.service.postAssign(input);
  }
}

