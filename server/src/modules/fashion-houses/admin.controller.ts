import { Controller, HttpCode, Inject, UseGuards, Get, Put, Patch } from "@nestjs/common";
import { FashionHouseAdminService } from "./admin.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { fashionHouseAdminInputs, type FashionHouseAdminInput } from "./admin.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/admin")
export class FashionHouseAdminController {
  constructor(@Inject(FashionHouseAdminService) private readonly service: FashionHouseAdminService) { }

  @Get("dashboard-summary")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  getDashboardSummary(@RequestInput(fashionHouseAdminInputs.getDashboardSummary) input: FashionHouseAdminInput<"getDashboardSummary">) {
    return this.service.getDashboardSummary(input);
  }

  @Get("summary")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  getSummary(@RequestInput(fashionHouseAdminInputs.getSummary) input: FashionHouseAdminInput<"getSummary">) {
    return this.service.getSummary(input);
  }

  @Get("profile")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  getProfile(@RequestInput(fashionHouseAdminInputs.getProfile) input: FashionHouseAdminInput<"getProfile">) {
    return this.service.getProfile(input);
  }

  @Put("onboarding")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  putOnboarding(@RequestInput(fashionHouseAdminInputs.putOnboarding) input: FashionHouseAdminInput<"putOnboarding">) {
    return this.service.putOnboarding(input);
  }

  @Patch("payment-details")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin")
  @HttpCode(200)
  patchPaymentDetails(@RequestInput(fashionHouseAdminInputs.patchPaymentDetails) input: FashionHouseAdminInput<"patchPaymentDetails">) {
    return this.service.patchPaymentDetails(input);
  }
}

