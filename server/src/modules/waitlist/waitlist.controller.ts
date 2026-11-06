import { Controller, HttpCode, Inject, UseGuards, Post, Get, Patch } from "@nestjs/common";
import { WaitlistService } from "./waitlist.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { waitlistInputs, type WaitlistInput } from "./waitlist.dto";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";
import { SessionGuard, PlatformAdminGuard } from "../../core/auth/access.guards";

@Controller("api/waitlist")
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly service: WaitlistService) { }

  @Get("stats")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("waitlist-stats", 120, 60000, false)
  getStats() {
    return this.service.getStats();
  }

  @Post("")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("waitlist", 10, 3600000, false)
  post(@RequestInput(waitlistInputs.post) input: WaitlistInput<"post">) {
    return this.service.post(input);
  }

  @Post("unsubscribe")
  @HttpCode(200)
  postUnsubscribe(@RequestInput(waitlistInputs.postUnsubscribe) input: WaitlistInput<"postUnsubscribe">) {
    return this.service.postUnsubscribe(input);
  }

  @Get("admin")
  @UseGuards(SessionGuard, PlatformAdminGuard)
  @HttpCode(200)
  getAdmin(@RequestInput(waitlistInputs.getAdmin) input: WaitlistInput<"getAdmin">) {
    return this.service.getAdmin(input);
  }

  @Patch("admin/:id/status")
  @UseGuards(SessionGuard, PlatformAdminGuard)
  @HttpCode(200)
  patchAdminByIdStatus(@RequestInput(waitlistInputs.patchAdminByIdStatus) input: WaitlistInput<"patchAdminByIdStatus">) {
    return this.service.patchAdminByIdStatus(input);
  }

  @Post("admin/invite")
  @UseGuards(SessionGuard, PlatformAdminGuard)
  @HttpCode(200)
  postAdminInvite(@RequestInput(waitlistInputs.postAdminInvite) input: WaitlistInput<"postAdminInvite">) {
    return this.service.postAdminInvite(input);
  }
}

