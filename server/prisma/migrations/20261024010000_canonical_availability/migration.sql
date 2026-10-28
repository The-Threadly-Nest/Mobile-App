ALTER TABLE "fashion_houses"
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
ADD COLUMN IF NOT EXISTS "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "available_slots"
ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill legacy ISO date/24-hour time slots in each fashion house's timezone.
UPDATE "available_slots" AS s
SET
  "startsAt" = ((s."date" || ' ' || s."time")::timestamp AT TIME ZONE fh."timezone"),
  "durationMinutes" = fh."slotDurationMinutes"
FROM "fashion_houses" AS fh
WHERE s."fashionHouseId" = fh."id"
  AND s."date" ~ '^\d{4}-\d{2}-\d{2}$'
  AND s."time" ~ '^([01]\d|2[0-3]):[0-5]\d$';

UPDATE "available_slots"
SET "endsAt" = "startsAt" + ("durationMinutes" * INTERVAL '1 minute')
WHERE "startsAt" IS NOT NULL;

-- Unbooked legacy display-only values cannot be offered safely as appointments.
DELETE FROM "available_slots"
WHERE "startsAt" IS NULL AND "booked" = FALSE;

CREATE INDEX IF NOT EXISTS "available_slots_fashionHouseId_active_booked_startsAt_idx"
ON "available_slots"("fashionHouseId", "active", "booked", "startsAt");

CREATE UNIQUE INDEX IF NOT EXISTS "available_slots_fashionHouseId_startsAt_key"
ON "available_slots"("fashionHouseId", "startsAt");

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'available_slots_no_active_overlap'
  ) THEN
    ALTER TABLE "available_slots"
    ADD CONSTRAINT "available_slots_no_active_overlap"
    EXCLUDE USING GIST (
      "fashionHouseId" WITH =,
      tstzrange("startsAt", "endsAt", '[)') WITH &&
    )
    WHERE ("active" = TRUE AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL);
  END IF;
END $$;
