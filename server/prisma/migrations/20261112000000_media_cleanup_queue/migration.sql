CREATE TABLE "media_cleanup_jobs" (
  "id" TEXT PRIMARY KEY,
  "prefix" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "attempts" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "media_cleanup_jobs_due_idx" ON "media_cleanup_jobs" ("nextAttemptAt");
-- Only the privileged identity connection may operate this deletion outbox.
REVOKE ALL ON TABLE "media_cleanup_jobs" FROM PUBLIC;
ALTER TABLE "media_cleanup_jobs" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "uploaded_media" (
  "key" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "uploaded_media_owner_idx" ON "uploaded_media" ("ownerId");
REVOKE ALL ON TABLE "uploaded_media" FROM PUBLIC;
ALTER TABLE "uploaded_media" ENABLE ROW LEVEL SECURITY;
