import { Controller, HttpCode, Inject, UseGuards, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RequestInput } from "../../core/http/endpoint-input";
import { authInputs, type AuthInput } from "./auth.dto";
import { EndpointRateGuard, RateLimit } from "../../core/http/endpoint-rate.guard";
import { SessionGuard } from "../../core/auth/access.guards";

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly service: AuthService) { }

  @Post("signup")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postSignup(@RequestInput(authInputs.postSignup) input: AuthInput<"postSignup">) {
    return this.service.postSignup(input);
  }

  @Post("login")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postLogin(@RequestInput(authInputs.postLogin) input: AuthInput<"postLogin">) {
    return this.service.postLogin(input);
  }

  @Post("forgot-password")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postForgotPassword(@RequestInput(authInputs.postForgotPassword) input: AuthInput<"postForgotPassword">) {
    return this.service.postForgotPassword(input);
  }

  @Post("reset-password")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postResetPassword(@RequestInput(authInputs.postResetPassword) input: AuthInput<"postResetPassword">) {
    return this.service.postResetPassword(input);
  }

  @Post("change-password")
  @UseGuards(SessionGuard, EndpointRateGuard)
  @HttpCode(200)

  @RateLimit("auth", 20, 900000, false)
  postChangePassword(@RequestInput(authInputs.postChangePassword) input: AuthInput<"postChangePassword">) {
    return this.service.postChangePassword(input);
  }

  @Post("activate-account")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postActivateAccount(@RequestInput(authInputs.postActivateAccount) input: AuthInput<"postActivateAccount">) {
    return this.service.postActivateAccount(input);
  }

  @Post("verify-code")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postVerifyCode(@RequestInput(authInputs.postVerifyCode) input: AuthInput<"postVerifyCode">) {
    return this.service.postVerifyCode(input);
  }

  @Post("resend-code")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postResendCode(@RequestInput(authInputs.postResendCode) input: AuthInput<"postResendCode">) {
    return this.service.postResendCode(input);
  }

  @Post("google")
  @HttpCode(200)
  @UseGuards(EndpointRateGuard)
  @RateLimit("auth", 20, 900000, false)
  postGoogle(@RequestInput(authInputs.postGoogle) input: AuthInput<"postGoogle">) {
    return this.service.postGoogle(input);
  }

  @Post("push-token")
  @UseGuards(SessionGuard)
  @HttpCode(200)
  postPushToken(@RequestInput(authInputs.postPushToken) input: AuthInput<"postPushToken">) {
    return this.service.postPushToken(input);
  }
}

