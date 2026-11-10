import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { OAuth2Client } = require("google-auth-library");
const { AuthService } = require("../dist/src/modules/identity/auth.service");
const { googleSignInSchema } = require("../dist/src/schemas/endpoint-bodies.schema");

test("Google login for a new email never auto-registers an account", async t => {
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = "test-client";
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ sub: "verified-google-id", email: "new@example.invalid", email_verified: true, name: "New user" }) });
  t.after(() => { OAuth2Client.prototype.verifyIdToken = originalVerify; if (clientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = clientId; });
  const service = new AuthService({ identityClient: {
    user: { findFirst: async () => null, create: () => assert.fail("Login must never create an account") },
    $transaction: () => assert.fail("Login must never register a user or fashion house"),
  } });
  for (const body of [{ idToken: "verified" }, { idToken: "verified", intent: "login" }]) {
    await assert.rejects(service.postGoogle({ body: googleSignInSchema.parse(body) }), (error: any) => error.getStatus() === 404 && error.getResponse().code === "ACCOUNT_NOT_FOUND");
  }
  assert.equal(googleSignInSchema.parse({ idToken: "verified", intent: "signup" }).intent, "signup");
  assert.throws(() => googleSignInSchema.parse({ idToken: "verified", intent: "unknown" }));
});

test("verified matching Google email activates an unexpired staff invitation without changing its role", async t => {
  const originalVerify = OAuth2Client.prototype.verifyIdToken;
  const oldClientId = process.env.GOOGLE_CLIENT_ID;
  const oldSecret = process.env.JWT_SECRET;
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.JWT_SECRET = "local-test-secret-not-for-deployment";
  OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ sub: "staff-google", email: "staff@example.invalid", email_verified: true }) });
  t.after(() => {
    OAuth2Client.prototype.verifyIdToken = originalVerify;
    for (const [key, value] of [["GOOGLE_CLIENT_ID", oldClientId], ["JWT_SECRET", oldSecret]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
  });
  let staff: any = { id: "staff", email: "staff@example.invalid", role: "staff", active: false, googleId: null, fashionHouseId: "house", passwordHash: null, resetTokenPurpose: "staff_activation", resetTokenExpiresAt: new Date(Date.now() + 60000) };
  let activations = 0;
  const service = new AuthService({ identityClient: { user: {
    findFirst: async () => staff,
    updateMany: async ({ where, data }: any) => { assert.equal(where.active, false); assert.equal(where.email, staff.email); activations++; staff = { ...staff, ...data }; return { count: 1 }; },
    findUnique: async () => staff,
    update: async ({ data }: any) => (staff = { ...staff, ...data }),
    create: () => assert.fail("Invited staff must not be registered as a new customer"),
  } } });
  const result = await service.postGoogle({ body: googleSignInSchema.parse({ idToken: "verified", intent: "login", role: "customer" }) });
  assert.equal(result.user.role, "staff");
  assert.equal(staff.fashionHouseId, "house");
  assert.equal(staff.active, true);
  assert.equal(staff.resetTokenPurpose, null);
  assert.equal(activations, 1);
  staff = { ...staff, active: false, resetTokenPurpose: "staff_activation", resetTokenExpiresAt: new Date(Date.now() - 1000) };
  await assert.rejects(service.postGoogle({ body: googleSignInSchema.parse({ idToken: "verified", intent: "login" }) }), (e: any) => e.getStatus() === 401);
  assert.equal(activations, 1);
});
