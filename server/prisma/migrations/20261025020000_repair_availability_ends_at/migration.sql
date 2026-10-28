-- Repair databases where the canonical availability migration was recorded
-- or partially applied before endsAt was introduced. This is additive and
-- preserves all existing slot and booking data.
ALTER TABLE "available_slots"
  ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMPTZ;

UPDATE "available_slots"
SET "endsAt" = "startsAt" + ("durationMinutes" * INTERVAL '1 minute')
WHERE "startsAt" IS NOT NULL
  AND "endsAt" IS NULL;
