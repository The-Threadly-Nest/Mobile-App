import { Controller, HttpCode, Inject, UseGuards, Post, Get } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { invoicesInputs, type InvoicesInput } from "./invoices.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/invoices")
export class InvoicesController {
  constructor(@Inject(InvoicesService) private readonly service: InvoicesService) { }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(invoicesInputs.post) input: InvoicesInput<"post">) {
    return this.service.post(input);
  }

  @Get("order/:orderId")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  getOrderByOrderId(@RequestInput(invoicesInputs.getOrderByOrderId) input: InvoicesInput<"getOrderByOrderId">) {
    return this.service.getOrderByOrderId(input);
  }
}

