ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "verificationHash" TEXT;
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "verificationExpiresAt" TIMESTAMP(3);
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "verificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "waitlist_entries" ADD COLUMN IF NOT EXISTS "verificationSentAt" TIMESTAMP(3);
