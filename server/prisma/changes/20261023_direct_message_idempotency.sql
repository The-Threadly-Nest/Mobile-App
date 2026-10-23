BEGIN;

ALTER TABLE "direct_messages"
  ADD COLUMN "clientMessageId" TEXT;

CREATE UNIQUE INDEX "direct_messages_senderId_clientMessageId_key"
  ON "direct_messages"("senderId", "clientMessageId");

COMMIT;
