BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "chat_escalations"
    WHERE "resolved" = FALSE
    GROUP BY "fashionHouseId", "customerId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate unresolved chat escalations must be resolved before applying this change.';
  END IF;
END $$;

ALTER TABLE "chat_escalations"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "activeKey" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "chat_escalations"
SET "status" = 'resolved'
WHERE "resolved" = TRUE;

UPDATE "chat_escalations"
SET "activeKey" = "fashionHouseId" || ':' || "customerId"
WHERE "resolved" = FALSE;

CREATE UNIQUE INDEX "chat_escalations_activeKey_key"
  ON "chat_escalations"("activeKey");

COMMIT;
