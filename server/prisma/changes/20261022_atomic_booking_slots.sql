-- Apply this change to an existing Threadly Nest PostgreSQL database before
-- deploying the matching API. The repository did not previously contain a
-- Prisma migration baseline, so this is intentionally an explicit SQL change.

BEGIN;

-- Stop instead of silently deleting data if a fashion house already has
-- duplicate availability rows that must be resolved by an administrator.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "available_slots"
    GROUP BY "fashionHouseId", "date", "time"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate fashion-house slots must be resolved before applying this change.';
  END IF;
END $$;

ALTER TABLE "bookings"
  ADD COLUMN "availableSlotId" TEXT;

CREATE UNIQUE INDEX "available_slots_fashionHouseId_date_time_key"
  ON "available_slots"("fashionHouseId", "date", "time");

CREATE UNIQUE INDEX "bookings_availableSlotId_key"
  ON "bookings"("availableSlotId");

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_availableSlotId_fkey"
  FOREIGN KEY ("availableSlotId")
  REFERENCES "available_slots"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

COMMIT;
