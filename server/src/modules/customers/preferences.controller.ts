import { Controller, HttpCode, Inject, UseGuards, Post, Get } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { preferencesInputs, type PreferencesInput } from "./preferences.dto";

import { SessionGuard } from "../../core/auth/access.guards";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";

@Controller("api/preferences")
export class PreferencesController {
  constructor(@Inject(PreferencesService) private readonly service: PreferencesService) { }

  @Post("")
  @UseGuards(SessionGuard, EndpointRateGuard)
  @RateLimit("profile-settings", 120, 3600000, true)
  @HttpCode(200)
  post(@RequestInput(preferencesInputs.post) input: PreferencesInput<"post">) {
    return this.service.post(input);
  }

  @Get("")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  get(@RequestInput(preferencesInputs.get) input: PreferencesInput<"get">) {
    return this.service.get(input);
  }
}

