import assert from "node:assert/strict";
import test from "node:test";
import { resolveDataMode } from "../../app-mobile/src/config/dataMode";
import { credentialVersion } from "../src/lib/session";
import { changePasswordSchema } from "../src/schemas/auth.schema";

test("password change accepts only current and policy-compliant new passwords", () => {
  const parsed = changePasswordSchema.parse({
    currentPassword: "CurrentPassword1",
    newPassword: "NewPassword2",
    email: "ignored@example.invalid",
  });

  assert.deepEqual(parsed, {
    currentPassword: "CurrentPassword1",
    newPassword: "NewPassword2",
  });
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: "CurrentPassword1",
      newPassword: "weak",
    }).success,
    false
  );
});

test("credential version changes when the password hash changes", () => {
  const before = credentialVersion("user-a", "old-hash", "test-secret");
  const after = credentialVersion("user-a", "new-hash", "test-secret");

  assert.notEqual(before, after);
  assert.equal(
    before,
    credentialVersion("user-a", "old-hash", "test-secret")
  );
});

test("production accepts real data mode and rejects mock or demo modes", () => {
  assert.equal(resolveDataMode(undefined, false), "real");
  assert.equal(resolveDataMode("real", false), "real");
  assert.throws(
    () => resolveDataMode("mock", false),
    /Production builds require/
  );
  assert.throws(
    () => resolveDataMode("demo", false),
    /Production builds require/
  );
});
