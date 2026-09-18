import { createHmac } from "crypto";

// Password changes revoke existing tokens without a schema migration.
// Tokens never contain the password hash or a reusable password verifier.
export function credentialVersion(userId: string, passwordHash: string | null, secret: string): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify([userId, passwordHash]))
    .digest("hex");
}
