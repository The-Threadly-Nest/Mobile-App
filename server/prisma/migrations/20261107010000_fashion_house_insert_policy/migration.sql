-- Grant the runtime role INSERT access on fashion_houses.
-- The original policy migration only granted SELECT + UPDATE, which blocked the
-- upsert (INSERT path) executed by PUT /api/admin/onboarding for first-time setup.
-- Run with the migration/identity owner connection, never the runtime login.

GRANT INSERT ON public.fashion_houses TO owuja_runtime;

-- RLS: an admin may only insert a fashion house whose adminId matches their own identity.
CREATE POLICY owuja_houses_insert ON public.fashion_houses FOR INSERT TO owuja_runtime
  WITH CHECK ("adminId" = owuja_security.actor());

