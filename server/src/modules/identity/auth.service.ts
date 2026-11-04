import { Inject, Injectable } from "@nestjs/common";
import { logFailure } from "../../core/logging";
import type { AuthInput } from "./auth.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

import { credentialVersion } from "../../lib/session";

import { codeMatches, hashPassword, verifyPassword, generateResetToken, hashResetToken } from "../../lib/password";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../../lib/mailer";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueToken(userId: string, email: string, role: string, fashionHouseId: string | null | undefined, passwordHash: string | null) {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw Object.assign(new Error("Server misconfiguration"), { status: 500 });
  const payload: Record<string, unknown> = { sub: userId, email, role, credentialVersion: credentialVersion(userId, passwordHash, JWT_SECRET) };
  if (fashionHouseId) payload.fashionHouseId = fashionHouseId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

// Only Admin and Customer self-register. Staff accounts are created
// exclusively by an Admin via POST /api/staff/invite.

// Same error message for "no such user" and "wrong password" — prevents
// email enumeration.

// Always returns the same response regardless of whether the email
// exists — standard defense against email enumeration.

// Used only by Staff accounts created via /api/staff/invite. Same
// pattern as reset-password, but refuses to run if passwordHash already
// exists, so a stale token can never hijack an already-active account.

@Injectable()
export class AuthService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async postSignup(input: AuthInput<"postSignup">) {

    const { email, password, role, name, businessName } = input.body;
    const existing = await this.database.identityClient.user.findUnique({ where: { email } });

    if (existing) {
      return rejectRequest({ error: "An account with this email already exists. Please log in instead." }, 400);
    }

    const passwordHash = await hashPassword(password);
    const isAdmin = role === "admin";
    const code = isAdmin ? generateResetToken() : undefined;
    const emailVerificationHash = code ? hashResetToken(code) : null;
    const emailVerificationExpiresAt = code ? new Date(Date.now() + 10 * 60 * 1000) : null;

    const { newUser: user, fashionHouseId: newFhId } = await this.database.identityClient.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role,
          active: true,
          emailVerificationHash,
          emailVerificationExpiresAt,
          emailVerificationSentAt: code ? new Date() : null,
        },
      });
      let fashionHouseId: string | null = null;
      if (role === "admin") {
        const fh = await tx.fashionHouse.create({ data: { adminId: newUser.id, shopName: businessName || name } });
        fashionHouseId = fh.id;
      }
      return { newUser, fashionHouseId };
    });

    sendWelcomeEmail(email, name, code).catch((mailErr) => {
      logFailure("The account was created, but its welcome email could not be sent.", mailErr);
    });
    const token = issueToken(user.id, user.email, user.role, newFhId, user.passwordHash);

    let shopName: string | null = null;
    let onboardingCompleted = false;
    if (user.role === "admin") {
      const fh = await this.database.identityClient.fashionHouse.findUnique({ where: { adminId: user.id } });
      if (fh) {
        if (fh.shopName) shopName = fh.shopName;
        onboardingCompleted = fh.onboardingCompleted ?? false;
      }
    }

    return result({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        shopName,
        isVerified: Boolean(user.emailVerifiedAt),
        onboardingCompleted,
        createdAt: user.createdAt,
      },
    }, 201);

  }

  async postLogin(input: AuthInput<"postLogin">) {

    const { email, password } = input.body;
    const user = await this.database.identityClient.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return rejectRequest({ error: "Incorrect email or password." }, 401);
    if (!user.active) return rejectRequest({ error: "This account hasn't been activated yet. Check your email for the activation link." }, 403);

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return rejectRequest({ error: "Incorrect email or password." }, 401);

    // Resolve fashionHouseId before token signing so it's embedded in the JWT
    let loginFashionHouseId: string | null = user.fashionHouseId ?? null;
    let shopName: string | null = null;
    let onboardingCompleted = false;

    if (user.role === "admin") {
      const fh = await this.database.identityClient.fashionHouse.findUnique({ where: { adminId: user.id } });
      if (fh) {
        loginFashionHouseId = fh.id;
        if (fh.shopName) shopName = fh.shopName;
        onboardingCompleted = fh.onboardingCompleted ?? false;
      }
    } else if (user.fashionHouseId) {
      const fh = await this.database.identityClient.fashionHouse.findUnique({ where: { id: user.fashionHouseId } });
      if (fh && fh.shopName) {
        shopName = fh.shopName;
      }
    }

    const token = issueToken(user.id, user.email, user.role, loginFashionHouseId, user.passwordHash);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        shopName,
        isVerified: Boolean(user.emailVerifiedAt),
        onboardingCompleted,
        createdAt: user.createdAt,
      },
    };

  }

  async postForgotPassword(input: AuthInput<"postForgotPassword">) {
    const email = input.body.email;
    const message = "If an account exists for this email, a reset code has been sent.";
    const user = await this.database.identityClient.user.findUnique({ where: { email } });
    if (!user?.active || !user.passwordHash) return { message };
    const now = new Date();
    const code = generateResetToken();
    const sent = await this.database.identityClient.user.updateMany({
      where: { id: user.id, OR: [{ resetTokenSentAt: null }, { resetTokenSentAt: { lt: new Date(now.getTime() - 60_000) } }] },
      data: { resetTokenHash: hashResetToken(code), resetTokenExpiresAt: new Date(now.getTime() + 600_000),
        resetTokenPurpose: "password_reset", resetTokenAttempts: 0, resetTokenSentAt: now },
    });
    if (sent.count) await sendPasswordResetEmail(email, code).catch((error) => logFailure("The password reset email could not be sent.", error));
    return { message };
  }

  async postResetPassword(input: AuthInput<"postResetPassword">) {
    const { email, token, newPassword } = input.body;
    const user = await this.database.identityClient.user.findUnique({ where: { email } });
    if (!user?.active || !user.passwordHash || user.resetTokenPurpose !== "password_reset" ||
        !user.resetTokenHash || !user.resetTokenExpiresAt || user.resetTokenExpiresAt <= new Date()) {
      return rejectRequest({ error: "This code is invalid or has expired. Please request a new one." }, 400);
    }
    const attempt = await this.database.identityClient.user.updateMany({
      where: { id: user.id, resetTokenHash: user.resetTokenHash, resetTokenPurpose: "password_reset",
        resetTokenExpiresAt: { gt: new Date() }, resetTokenAttempts: { lt: 5 } },
      data: { resetTokenAttempts: { increment: 1 } },
    });
    if (!attempt.count || !codeMatches(token, user.resetTokenHash)) {
      return rejectRequest({ error: "That code didn't match. Please check it or request a new code." }, 400);
    }
    const passwordHash = await hashPassword(newPassword);
    const updated = await this.database.identityClient.user.updateMany({
      where: { id: user.id, resetTokenHash: user.resetTokenHash, resetTokenPurpose: "password_reset",
        resetTokenExpiresAt: { gt: new Date() }, resetTokenAttempts: { lte: 5 }, active: true },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null, resetTokenPurpose: null,
        resetTokenAttempts: 0, emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        emailVerificationHash: null, emailVerificationExpiresAt: null, emailVerificationAttempts: 0 },
    });
    if (!updated.count) return rejectRequest({ error: "This code has already been used or has expired. Please request a new one." }, 400);
    return { message: "Password updated. You can now log in with your new password." };
  }

  async postChangePassword(input: AuthInput<"postChangePassword">) {

    const { currentPassword, newPassword } = input.body;
    const user = await this.database.identityClient.user.findUnique({ where: { id: input.authUserId! } });
    if (!user || !user.passwordHash) {
      return rejectRequest({ error: "Incorrect email or current password." }, 401);
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return rejectRequest({ error: "Incorrect current password." }, 401);
    }

    const newPasswordHash = await hashPassword(newPassword);
    await this.database.identityClient.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash, resetTokenHash: null, resetTokenExpiresAt: null, resetTokenPurpose: null, resetTokenAttempts: 0 },
    });

    return { message: "Password updated successfully.", token: issueToken(user.id, user.email, user.role, input.authFashionHouseId, newPasswordHash) };

  }

  async postActivateAccount(input: AuthInput<"postActivateAccount">) {
    const { email, token, password } = input.body;
    const user = await this.database.identityClient.user.findUnique({ where: { email } });
    if (!user || user.role !== "staff" || user.active || user.passwordHash || user.resetTokenPurpose !== "staff_activation" ||
        !user.resetTokenHash || !user.resetTokenExpiresAt || user.resetTokenExpiresAt <= new Date()) {
      return rejectRequest({ error: "This invitation code is invalid or has expired. Ask your admin for a new one." }, 400);
    }
    const attempt = await this.database.identityClient.user.updateMany({
      where: { id: user.id, resetTokenHash: user.resetTokenHash, resetTokenPurpose: "staff_activation",
        resetTokenExpiresAt: { gt: new Date() }, resetTokenAttempts: { lt: 5 }, active: false, passwordHash: null },
      data: { resetTokenAttempts: { increment: 1 } },
    });
    if (!attempt.count || !codeMatches(token, user.resetTokenHash)) {
      return rejectRequest({ error: "That invitation code didn't match. Please check it or ask your admin for a new one." }, 400);
    }
    const passwordHash = await hashPassword(password);
    const updated = await this.database.identityClient.user.updateMany({
      where: { id: user.id, resetTokenHash: user.resetTokenHash, resetTokenPurpose: "staff_activation",
        resetTokenExpiresAt: { gt: new Date() }, resetTokenAttempts: { lte: 5 }, active: false, passwordHash: null },
      data: { passwordHash, active: true, emailVerifiedAt: new Date(), resetTokenHash: null,
        resetTokenExpiresAt: null, resetTokenPurpose: null, resetTokenAttempts: 0 },
    });
    if (!updated.count) return rejectRequest({ error: "This invitation was already used or has expired. Ask your admin for a new one." }, 400);
    return { token: issueToken(user.id, user.email, user.role, user.fashionHouseId, passwordHash),
      user: { id: user.id, email: user.email, role: user.role, isVerified: true } };
  }

  async postVerifyCode(input: AuthInput<"postVerifyCode">) {
    const { email, code } = input.body;
    const user = await this.database.identityClient.user.findUnique({ where: { email } });
    if (!user?.active || !user.emailVerificationHash || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      return rejectRequest({ error: "This code is invalid or has expired. Please request a new one." }, 400);
    }
    const attempt = await this.database.identityClient.user.updateMany({
      where: { id: user.id, emailVerificationHash: user.emailVerificationHash,
        emailVerificationExpiresAt: { gt: new Date() }, emailVerificationAttempts: { lt: 5 } },
      data: { emailVerificationAttempts: { increment: 1 } },
    });
    if (!attempt.count || !codeMatches(code, user.emailVerificationHash)) {
      return rejectRequest({ error: "That code didn't match. Please check it or request a new code." }, 400);
    }
    const verified = await this.database.identityClient.user.updateMany({
      where: { id: user.id, emailVerificationHash: user.emailVerificationHash, emailVerificationExpiresAt: { gt: new Date() } },
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), emailVerificationHash: null,
        emailVerificationExpiresAt: null, emailVerificationAttempts: 0 },
    });
    if (!verified.count) return rejectRequest({ error: "This code has already been used or has expired. Please request a new one." }, 400);
    return { message: "Your email is verified." };
  }

  async postResendCode(input: AuthInput<"postResendCode">) {
    const { email } = input.body;
    const message = "If your account needs verification, a new code has been sent.";
    const user = await this.database.identityClient.user.findUnique({ where: { email } });
    if (!user?.active || user.emailVerifiedAt) return { message };
    const now = new Date();
    const code = generateResetToken();
    const sent = await this.database.identityClient.user.updateMany({
      where: { id: user.id, emailVerifiedAt: null,
        OR: [{ emailVerificationSentAt: null }, { emailVerificationSentAt: { lt: new Date(now.getTime() - 60_000) } }] },
      data: { emailVerificationHash: hashResetToken(code), emailVerificationExpiresAt: new Date(now.getTime() + 600_000),
        emailVerificationAttempts: 0, emailVerificationSentAt: now },
    });
    if (sent.count) await sendWelcomeEmail(user.email, user.name || "there", code).catch((error) => logFailure("The verification email could not be sent.", error));
    return { message };
  }

  async postGoogle(input: AuthInput<"postGoogle">) {

    const { idToken, role } = input.body;
    if (!idToken) return rejectRequest({ error: "Google sign-in didn't finish. Please try again." }, 400);

    // Restrict self-registration to customer or admin only (staff are invited by admins)
    const safeRole: "admin" | "customer" = role === "admin" ? "admin" : "customer";

    // Verify token with Google and check audience matches THIS app's client ID
    if (!process.env.GOOGLE_CLIENT_ID) {
      return rejectRequest({ error: "Server misconfiguration: missing GOOGLE_CLIENT_ID." }, 500);
    }
    let googleId: string;
    let email: string;
    let name: string | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email_verified) throw new Error("Unverified Google identity");
      googleId = payload.sub;
      email = payload.email!;
      name = payload.name;
    } catch {
      return rejectRequest({ error: "Google sign-in has expired. Please try signing in again." }, 401);
    }

    if (!email) return rejectRequest({ error: "Google account did not provide an email address." }, 400);

    let user = await this.database.identityClient.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: { fashionHouseOwned: true },
    });

    if (user && (!user.active || (user.googleId && user.googleId !== googleId))) {
      return rejectRequest({ error: "Unable to sign in with this account." }, 401);
    }

    if (!user) {
      // Create new user with selected role
      const createdUserId = await this.database.identityClient.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            googleId,
            name: name ?? "",
            role: safeRole,
            active: true,
            emailVerifiedAt: new Date(),
          },
        });

        if (safeRole === "admin") {
          await tx.fashionHouse.create({
            data: { adminId: newUser.id, shopName: "", onboardingCompleted: false },
          });
        }
        return newUser.id;
      });

      user = (await this.database.identityClient.user.findUnique({
        where: { id: createdUserId },
        include: { fashionHouseOwned: true },
      }))!;

      // Send welcome email to newly created Google user (no PIN required)
      sendWelcomeEmail(user.email, user.name || "there").catch((mailErr) => {
        logFailure("Google sign-in succeeded, but the welcome email could not be sent.", mailErr);
      });
    } else {
      // Link Google ID to existing email account
      user = await this.database.identityClient.user.update({
        where: { id: user.id },
        data: { googleId, emailVerifiedAt: user.emailVerifiedAt ?? new Date(), emailVerificationHash: null, emailVerificationExpiresAt: null, emailVerificationAttempts: 0 },
        include: { fashionHouseOwned: true },
      });
    }

    const onboardingCompleted = user.fashionHouseOwned?.onboardingCompleted ?? false;
    const googleFhId = user.fashionHouseOwned?.id ?? user.fashionHouseId ?? null;
    const token = issueToken(user.id, user.email, user.role, googleFhId, user.passwordHash);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        shopName: user.fashionHouseOwned?.shopName ?? "",
        onboardingCompleted,
        isVerified: true,
      },
    };

  }

  async postPushToken(input: AuthInput<"postPushToken">) {

    const { pushToken } = input.body;
    if (!pushToken || typeof pushToken !== "string") {
      return rejectRequest({ error: "We couldn't enable notifications. Please try again." }, 400);
    }
    const user = await this.database.identityClient.user.findUnique({ where: { id: input.authUserId! } });
    if (!user) {
      return rejectRequest({ error: "Your session has expired. Please log in again." }, 401);
    }
    await this.database.identityClient.user.update({
      where: { id: input.authUserId! },
      data: { pushToken },
    });
    return { success: true, message: "Push token registered successfully." };

  }

}

