import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";

const { Logger } = require("@nestjs/common");
const { AuthService } = require("../dist/src/modules/identity/auth.service");
const { PlatformAdminGuard } = require("../dist/src/core/auth/access.guards");
const { UploadService } = require("../dist/src/modules/media/upload.service");
const { hashResetToken } = require("../dist/src/lib/password");
const { measurementCaptureSchema } = require("../dist/src/schemas/endpoint-bodies.schema");
const { defaultRouteParamsSchema, chatTargetParamSchema } = require("../dist/src/schemas/route-params.schema");
const { assertAudioContent } = require("../dist/src/core/http/audio-validation");

function userStore(overrides: Record<string, unknown> = {}) {
  const state: any = {
    id: "11111111-1111-4111-8111-111111111111", email: "fixture@example.invalid", role: "admin", active: true,
    passwordHash: "fixture-hash", emailVerifiedAt: null, emailVerificationHash: hashResetToken("ABCD"),
    emailVerificationExpiresAt: new Date(Date.now() + 600_000), emailVerificationAttempts: 0,
    resetTokenHash: "unrelated-password-reset-hash", resetTokenExpiresAt: new Date(Date.now() + 600_000),
    resetTokenPurpose: "password_reset", resetTokenAttempts: 0, ...overrides,
  };
  const matches = (where: Record<string, any>) => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("gt" in value) return state[key] > value.gt;
      if ("lt" in value) return state[key] < value.lt;
      if ("lte" in value) return state[key] <= value.lte;
    }
    return state[key] === value;
  });
  const database = { client: { user: {
    findUnique: async () => structuredClone(state),
    updateMany: async ({ where, data }: any) => {
      if (!matches(where)) return { count: 0 };
      for (const [key, value] of Object.entries(data)) state[key] = value && typeof value === "object" && "increment" in value
        ? state[key] + (value as any).increment : value;
      return { count: 1 };
    },
  } } };
  return { state, service: new AuthService({ ...database, identityClient: database.client }) };
}

test("incorrect verification never marks an email verified or clears a reset token", async () => {
  const { state, service } = userStore();
  await assert.rejects(service.postVerifyCode({ body: { email: state.email, code: "ZZZZ" } }), (error: any) => error.getStatus() === 400);
  assert.equal(state.emailVerifiedAt, null);
  assert.equal(state.emailVerificationHash, hashResetToken("ABCD"));
  assert.equal(state.emailVerificationAttempts, 1);
  assert.equal(state.resetTokenHash, "unrelated-password-reset-hash");
});

test("verification stops after five attempts, including a later correct guess", async () => {
  const { state, service } = userStore();
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(service.postVerifyCode({ body: { email: state.email, code: "ZZZZ" } }));
  await assert.rejects(service.postVerifyCode({ body: { email: state.email, code: "ABCD" } }));
  assert.equal(state.emailVerificationAttempts, 5);
  assert.equal(state.emailVerifiedAt, null);
});

test("an expired verification code remains unverified", async () => {
  const { state, service } = userStore({ emailVerificationExpiresAt: new Date(0) });
  await assert.rejects(service.postVerifyCode({ body: { email: state.email, code: "ABCD" } }));
  assert.equal(state.emailVerifiedAt, null);
  assert.equal(state.emailVerificationHash, hashResetToken("ABCD"));
});

test("a valid verification is consumed once without altering password-reset state", async () => {
  const { state, service } = userStore();
  await service.postVerifyCode({ body: { email: state.email, code: "ABCD" } });
  assert.ok(state.emailVerifiedAt instanceof Date);
  assert.equal(state.emailVerificationHash, null);
  assert.equal(state.resetTokenHash, "unrelated-password-reset-hash");
  await assert.rejects(service.postVerifyCode({ body: { email: state.email, code: "ABCD" } }));
});

test("verification and activation codes cannot be used as password-reset codes", async () => {
  for (const purpose of [null, "staff_activation", "email_verification"]) {
    const { state, service } = userStore({ resetTokenPurpose: purpose, resetTokenHash: hashResetToken("ABCD") });
    await assert.rejects(service.postResetPassword({ body: { email: state.email, token: "ABCD", newPassword: "NewPassword123" } }));
    assert.equal(state.passwordHash, "fixture-hash");
  }
});

test("platform administration requires a verified admin as well as an allowlisted email", () => {
  const previous = process.env.PLATFORM_ADMIN_EMAILS;
  process.env.PLATFORM_ADMIN_EMAILS = "privileged@example.invalid";
  const guard = new PlatformAdminGuard();
  const context = (role: string, verified: boolean) => ({ switchToHttp: () => ({ getRequest: () => ({
    authEmail: "privileged@example.invalid", authRole: role, authEmailVerified: verified,
  }) }) });
  try {
    assert.throws(() => guard.canActivate(context("customer", true)));
    assert.throws(() => guard.canActivate(context("staff", true)));
    assert.throws(() => guard.canActivate(context("admin", false)));
    assert.equal(guard.canActivate(context("admin", true)), true);
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = previous;
  }
});

test("rejecting another tenant's upload never reads or deletes that object", async () => {
  Logger.overrideLogger(false);
  const storage = require("../dist/src/lib/s3");
  const originalRead = storage.readStoredObject;
  const originalDelete = storage.deleteStoredObject;
  let reads = 0, deletes = 0;
  storage.readStoredObject = async () => { reads++; throw new Error("No storage access expected"); };
  storage.deleteStoredObject = async () => { deletes++; };
  const ownId = "11111111-1111-4111-8111-111111111111";
  const service = new UploadService({ client: { user: { findUnique: async () => ({ id: ownId, role: "customer" }) } } });
  try {
    await assert.rejects(service.postCompleteImage({ authUserId: ownId,
      body: { key: "pending/customers/22222222-2222-4222-8222-222222222222/fixture.png" } }), (error: any) => error.getStatus() === 403);
    assert.equal(reads, 0);
    assert.equal(deletes, 0);
  } finally {
    storage.readStoredObject = originalRead;
    storage.deleteStoredObject = originalDelete;
  }
});

test("measurements reject negative, zero, nonnumeric and excessive values", () => {
  for (const value of [-5, 0, "-5", "zero", 1001, Infinity]) assert.equal(measurementCaptureSchema.safeParse({
    customerId: "11111111-1111-4111-8111-111111111111", field: "waist", value,
  }).success, false);
});

test("route parameters reject invalid IDs but keep the supported default chat target", () => {
  assert.equal(defaultRouteParamsSchema.safeParse({ customerId: "not-a-uuid" }).success, false);
  assert.equal(defaultRouteParamsSchema.safeParse({ id: ["one", "two"] }).success, false);
  assert.equal(chatTargetParamSchema.safeParse({ fashionHouseId: "default" }).success, true);
});

test("voice parsing rejects spoofed MIME types and accepts a supported container header", () => {
  assert.throws(() => assertAudioContent({ mimetype: "audio/mp4", buffer: Buffer.from("not-an-audio-file") }));
  assert.throws(() => assertAudioContent({ mimetype: "application/octet-stream", buffer: Buffer.from("RIFF1234WAVE") }));
  assert.doesNotThrow(() => assertAudioContent({ mimetype: "audio/wav", buffer: Buffer.from("RIFF1234WAVEpayload") }));
});
