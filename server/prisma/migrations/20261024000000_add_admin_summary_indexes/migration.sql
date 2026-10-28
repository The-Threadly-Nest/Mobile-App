-- Support tenant staff counts and monthly invoice/payment summaries.
CREATE INDEX IF NOT EXISTS "users_fashionHouseId_role_idx"
ON "users"("fashionHouseId", "role");

CREATE INDEX IF NOT EXISTS "invoices_createdAt_idx"
ON "invoices"("createdAt");

CREATE INDEX IF NOT EXISTS "invoices_paymentStatus_createdAt_idx"
ON "invoices"("paymentStatus", "createdAt");
