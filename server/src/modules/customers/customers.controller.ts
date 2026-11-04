import { Controller, HttpCode, Inject, UseGuards, Get, Patch } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { customersInputs, type CustomersInput } from "./customers.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/customers")
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly service: CustomersService) { }

  @Get("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  get(@RequestInput(customersInputs.get) input: CustomersInput<"get">) {
    return this.service.get(input);
  }

  @Patch(":id/status")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  patchByIdStatus(@RequestInput(customersInputs.patchByIdStatus) input: CustomersInput<"patchByIdStatus">) {
    return this.service.patchByIdStatus(input);
  }
}

