CREATE TABLE "decline_records" (
  id TEXT PRIMARY KEY,
  "fashionHouseId" TEXT NOT NULL REFERENCES fashion_houses(id) ON DELETE CASCADE,
  "targetId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  comment TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX decline_records_house_target_idx ON decline_records ("fashionHouseId", "targetId");
ALTER TABLE decline_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON decline_records TO owuja_runtime;
CREATE POLICY decline_records_owner ON decline_records TO owuja_runtime
USING (owuja_security.house_member("fashionHouseId", TRUE))
WITH CHECK ("actorId" = owuja_security.actor() AND owuja_security.house_member("fashionHouseId", TRUE));
