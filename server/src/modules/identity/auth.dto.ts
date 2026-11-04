import { changePasswordSchema, signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, activateAccountSchema } from "../../schemas/auth.schema";
import type { ValidatedInput } from "../../core/http/endpoint-input";
import { verifyAccountCodeSchema, resendAccountCodeSchema, googleSignInSchema, pushTokenSchema } from "../../schemas/endpoint-bodies.schema";

export const authInputs = {
  postSignup: { body: signupSchema },
  postLogin: { body: loginSchema },
  postForgotPassword: { body: forgotPasswordSchema },
  postResetPassword: { body: resetPasswordSchema },
  postChangePassword: { body: changePasswordSchema },
  postActivateAccount: { body: activateAccountSchema },
  postVerifyCode: { body: verifyAccountCodeSchema },
  postResendCode: { body: resendAccountCodeSchema },
  postGoogle: { body: googleSignInSchema },
  postPushToken: { body: pushTokenSchema },
} as const;

export type AuthInput<K extends keyof typeof authInputs> = ValidatedInput<(typeof authInputs)[K]>;
