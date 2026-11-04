CREATE TABLE IF NOT EXISTS "waitlist_entries" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "businessName" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "instagram" TEXT,
  "interests" TEXT,
  "source" TEXT,
  "referralCode" TEXT NOT NULL,
  "referredBy" TEXT,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "consentedAt" TIMESTAMP(3) NOT NULL,
  "confirmationSentAt" TIMESTAMP(3),
  "invitedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "waitlist_entries_audience_check" CHECK ("audience" IN ('customer', 'fashion_house')),
  CONSTRAINT "waitlist_entries_status_check" CHECK ("status" IN ('waiting', 'invited', 'joined', 'unsubscribed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_entries_email_key" ON "waitlist_entries"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_entries_referralCode_key" ON "waitlist_entries"("referralCode");
CREATE INDEX IF NOT EXISTS "waitlist_entries_audience_status_createdAt_idx" ON "waitlist_entries"("audience", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "waitlist_entries_status_createdAt_idx" ON "waitlist_entries"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "waitlist_entries_referredBy_idx" ON "waitlist_entries"("referredBy");
