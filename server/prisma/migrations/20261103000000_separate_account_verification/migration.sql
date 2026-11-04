-- Additive security change. No tables or customer data are removed.
ALTER TABLE "users"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationHash" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3),
  ADD COLUMN "resetTokenPurpose" TEXT,
  ADD COLUMN "resetTokenAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "resetTokenSentAt" TIMESTAMP(3);

-- Google identities were linked only after Google's email_verified check.
-- Do not infer verification from the absence of a legacy reset token.
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "googleId" IS NOT NULL;

-- Preserve still-pending staff invitations with an explicit purpose.
UPDATE "users" SET "resetTokenPurpose" = 'staff_activation'
WHERE "role" = 'staff' AND "active" = FALSE AND "passwordHash" IS NULL
  AND "resetTokenHash" IS NOT NULL;

-- Legacy tokens mixed verification and password resets. Invalidate ambiguous
-- tokens rather than grant verification accidentally; users can request a new code.
UPDATE "users" SET "resetTokenHash" = NULL, "resetTokenExpiresAt" = NULL
WHERE "resetTokenPurpose" IS NULL;

-- Shared, atomic counters for production rate limits. Keys contain a SHA-256
-- digest, never a plaintext email address, account ID or IP address.
CREATE TABLE "rate_limit_buckets" (
  "key" TEXT PRIMARY KEY,
  "hits" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "rate_limit_buckets_resetAt_idx" ON "rate_limit_buckets"("resetAt");
