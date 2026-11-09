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
