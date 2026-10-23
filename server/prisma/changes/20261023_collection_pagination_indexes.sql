BEGIN;

CREATE INDEX "fashion_houses_createdAt_idx"
  ON "fashion_houses"("createdAt");

CREATE INDEX "customers_fashionHouseId_name_idx"
  ON "customers"("fashionHouseId", "name");

CREATE INDEX "orders_fashionHouseId_createdAt_idx"
  ON "orders"("fashionHouseId", "createdAt");

CREATE INDEX "catalog_items_fashionHouseId_createdAt_idx"
  ON "catalog_items"("fashionHouseId", "createdAt");

CREATE INDEX "catalog_items_createdAt_idx"
  ON "catalog_items"("createdAt");

CREATE INDEX "bookings_customerId_createdAt_idx"
  ON "bookings"("customerId", "createdAt");

COMMIT;
