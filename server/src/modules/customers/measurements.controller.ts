import { Controller, HttpCode, UseInterceptors, Inject, UseGuards, Get, Post } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { MeasurementsService } from "./measurements.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";
import { validateAudioFile } from "../../core/http/audio-validation";
import { measurementsInputs, type MeasurementsInput } from "./measurements.dto";

import { SessionGuard, RolesGuard, AllowedRoles } from "../../core/auth/access.guards";

@Controller("api/measurements")
export class MeasurementsController {
  constructor(@Inject(MeasurementsService) private readonly service: MeasurementsService) { }

  @Get("my-measurements")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  getMyMeasurements(@RequestInput(measurementsInputs.getMyMeasurements) input: MeasurementsInput<"getMyMeasurements">) {
    return this.service.getMyMeasurements(input);
  }

  @Get("check/:customerName")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  getCheckByCustomerName(@RequestInput(measurementsInputs.getCheckByCustomerName) input: MeasurementsInput<"getCheckByCustomerName">) {
    return this.service.getCheckByCustomerName(input);
  }

  @Post("")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  post(@RequestInput(measurementsInputs.post) input: MeasurementsInput<"post">) {
    return this.service.post(input);
  }

  @Get("customer/:customerId")
  @UseGuards(SessionGuard, RolesGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  getCustomerByCustomerId(@RequestInput(measurementsInputs.getCustomerByCustomerId) input: MeasurementsInput<"getCustomerByCustomerId">) {
    return this.service.getCustomerByCustomerId(input);
  }

  @Post("parse-voice")
  @UseGuards(SessionGuard, RolesGuard, EndpointRateGuard)
  @AllowedRoles("admin", "staff")
  @HttpCode(200)
  @RateLimit("voice-parser", 10, 600000, true)
  @UseInterceptors(FileInterceptor("audio", { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0, parts: 1 }, fileFilter: validateAudioFile }))
  postParseVoice(@RequestInput(measurementsInputs.postParseVoice) input: MeasurementsInput<"postParseVoice">) {
    return this.service.postParseVoice(input);
  }
}


