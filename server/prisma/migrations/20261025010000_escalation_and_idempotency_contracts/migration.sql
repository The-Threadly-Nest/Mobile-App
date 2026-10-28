-- Runtime fields required by human handoff and duplicate-safe order creation.
-- IF NOT EXISTS keeps this safe for development databases previously updated with prisma db push.

ALTER TABLE "chat_escalations"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "activeKey" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_escalations_activeKey_key"
  ON "chat_escalations"("activeKey");

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_fashionHouseId_idempotencyKey_key"
  ON "orders"("fashionHouseId", "idempotencyKey");

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "bookings_customerId_idempotencyKey_key"
  ON "bookings"("customerId", "idempotencyKey");
