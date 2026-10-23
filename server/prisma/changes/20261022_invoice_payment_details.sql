BEGIN;

ALTER TABLE "invoices"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "accountNumber" TEXT,
  ADD COLUMN "accountName" TEXT;

COMMIT;
