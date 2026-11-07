-- Optional rules for generating dated availability. Existing appointments stay intact.
ALTER TABLE "fashion_houses" ADD COLUMN "bookingSchedule" JSONB;
