ALTER TABLE "customer_preferences" ADD COLUMN IF NOT EXISTS "photoKey" TEXT;
ALTER TABLE "customer_preferences" ADD COLUMN IF NOT EXISTS "savedCatalogIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
