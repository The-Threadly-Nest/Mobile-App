BEGIN;

CREATE INDEX "direct_messages_customerId_createdAt_idx"
  ON "direct_messages"("customerId", "createdAt");

COMMIT;
