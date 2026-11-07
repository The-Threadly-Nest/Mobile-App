ALTER TABLE "catalog_items" ADD COLUMN "fulfillmentType" TEXT NOT NULL DEFAULT 'custom_fit';
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_fulfillment_type_check" CHECK ("fulfillmentType" IN ('ready_to_wear', 'custom_fit'));
ALTER TABLE "orders" ADD COLUMN "items" JSONB;
ALTER TABLE "bookings" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'fitting';
ALTER TABLE "bookings" ADD COLUMN "catalogItemId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "catalogSnapshot" JSONB;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
