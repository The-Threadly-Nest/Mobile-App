import { Controller, HttpCode, Inject, UseGuards, Post } from "@nestjs/common";
import { UploadService } from "./upload.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { uploadInputs, type UploadInput } from "./upload.dto";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";
import { SessionGuard } from "../../core/auth/access.guards";

@Controller("api/upload")
export class UploadController {
  constructor(@Inject(UploadService) private readonly service: UploadService) { }

  @Post("presign")
  @UseGuards(SessionGuard, EndpointRateGuard)
  @HttpCode(200)

  @RateLimit("upload", 60, 900000, false)
  postPresign(@RequestInput(uploadInputs.postPresign) input: UploadInput<"postPresign">) {
    return this.service.postPresign(input);
  }

  @Post("complete-image")
  @UseGuards(SessionGuard, EndpointRateGuard)
  @HttpCode(200)

  @RateLimit("upload", 60, 900000, false)
  postCompleteImage(@RequestInput(uploadInputs.postCompleteImage) input: UploadInput<"postCompleteImage">) {
    return this.service.postCompleteImage(input);
  }
}

