-- Run with the migration/identity owner, never the restricted runtime login.
-- A separate NOBYPASSRLS, non-owner login must inherit owuja_runtime.
-- Existing owner connections retain access during the development rollout.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'owuja_runtime') THEN
    CREATE ROLE owuja_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
-- The migration owner can validate the restricted role with SET LOCAL ROLE.
-- This does not remove or expand the owner's existing table-owner privileges.
DO $$ BEGIN EXECUTE format('GRANT owuja_runtime TO %I', current_user); END $$;

CREATE SCHEMA IF NOT EXISTS owuja_security;
REVOKE ALL ON SCHEMA owuja_security FROM PUBLIC;
GRANT USAGE ON SCHEMA public, owuja_security TO owuja_runtime;

CREATE FUNCTION owuja_security.actor() RETURNS TEXT LANGUAGE SQL STABLE AS
$$ SELECT NULLIF(current_setting('owuja.user_id', TRUE), '') $$;

CREATE FUNCTION owuja_security.customer_actor(account TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT account = owuja_security.actor() AND EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = account AND u.role = 'customer' AND u.active)
$$;

CREATE FUNCTION owuja_security.house_member(house TEXT, owner_only BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = owuja_security.actor() AND u.active
      AND ((u.role = 'admin' AND EXISTS (SELECT 1 FROM public.fashion_houses h WHERE h.id = house AND h."adminId" = u.id))
        OR (NOT owner_only AND u.role = 'staff' AND u."fashionHouseId" = house))
  )
$$;

CREATE FUNCTION owuja_security.customer_access(customer TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer
    AND (owuja_security.customer_actor(c."userId") OR owuja_security.house_member(c."fashionHouseId")))
$$;

CREATE FUNCTION owuja_security.order_links(customer TEXT, house TEXT, staff TEXT, booking TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer AND c."fashionHouseId" = house
    AND (staff IS NULL OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = staff AND u.role = 'staff' AND u."fashionHouseId" = house))
    AND (booking IS NULL OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking AND b."fashionHouseId" = house AND b."customerId" = c."userId")))
$$;

CREATE FUNCTION owuja_security.associated_customer(account TEXT, house TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT owuja_security.house_member(house) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = account AND u.role = 'customer' AND (
    EXISTS (SELECT 1 FROM public.customers c WHERE c."userId" = account AND c."fashionHouseId" = house) OR
    EXISTS (SELECT 1 FROM public.bookings b WHERE b."customerId" = account AND b."fashionHouseId" = house) OR
    EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s."customerId" = account AND s."fashionHouseId" = house) OR
    EXISTS (SELECT 1 FROM public.chat_escalations e WHERE e."customerId" = account AND e."fashionHouseId" = house) OR
    EXISTS (SELECT 1 FROM public.direct_messages m WHERE m."customerId" = account AND m."fashionHouseId" = house)))
$$;

CREATE FUNCTION owuja_security.order_access(order_id TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (owuja_security.house_member(o."fashionHouseId") OR owuja_security.customer_access(o."customerId")))
$$;

CREATE FUNCTION owuja_security.creator_access(creator TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT creator = owuja_security.actor() OR EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = creator AND
      (owuja_security.house_member(u."fashionHouseId", TRUE) OR EXISTS (
        SELECT 1 FROM public.fashion_houses h WHERE h."adminId" = u.id AND owuja_security.house_member(h.id, TRUE)))
  )
$$;

CREATE FUNCTION owuja_security.slot_booking_owner(slot TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bookings b WHERE b."availableSlotId" = slot AND b."customerId" = owuja_security.actor())
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA owuja_security FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA owuja_security TO owuja_runtime;

GRANT SELECT, INSERT, UPDATE ON public.users TO owuja_runtime;
GRANT SELECT, UPDATE ON public.fashion_houses TO owuja_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers, public.measurements, public.orders,
  public.invoices, public.catalog_items, public.available_slots, public.bookings,
  public.chat_escalations, public.sketches, public.customer_preferences, public.mood_board_sketches,
  public.chat_sessions, public.direct_messages, public.direct_message_thread_states,
  public.direct_message_user_deletions TO owuja_runtime;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_users_read ON public.users FOR SELECT TO owuja_runtime
  USING (id = owuja_security.actor() OR (role = 'staff' AND owuja_security.house_member("fashionHouseId"))
    OR (role = 'admin' AND EXISTS (SELECT 1 FROM public.fashion_houses h WHERE h."adminId" = users.id AND owuja_security.house_member(h.id)))
    OR owuja_security.associated_customer(id, NULLIF(current_setting('owuja.house_id', TRUE), '')));
CREATE POLICY owuja_staff_insert ON public.users FOR INSERT TO owuja_runtime
  WITH CHECK (role = 'staff' AND NOT active AND "passwordHash" IS NULL AND owuja_security.house_member("fashionHouseId", TRUE));
CREATE POLICY owuja_staff_update ON public.users FOR UPDATE TO owuja_runtime
  USING (role = 'staff' AND owuja_security.house_member("fashionHouseId", TRUE))
  WITH CHECK (role = 'staff' AND owuja_security.house_member("fashionHouseId", TRUE));

ALTER TABLE public.fashion_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_houses_read ON public.fashion_houses FOR SELECT TO owuja_runtime USING (owuja_security.actor() IS NOT NULL);
CREATE POLICY owuja_houses_update ON public.fashion_houses FOR UPDATE TO owuja_runtime
  USING ("adminId" = owuja_security.actor()) WITH CHECK ("adminId" = owuja_security.actor());

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_customers ON public.customers TO owuja_runtime
  USING (owuja_security.customer_actor("userId") OR owuja_security.house_member("fashionHouseId"))
  WITH CHECK (owuja_security.customer_actor("userId") OR owuja_security.house_member("fashionHouseId"));

ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_measurements_read ON public.measurements FOR SELECT TO owuja_runtime USING (owuja_security.customer_access("customerId"));
CREATE POLICY owuja_measurements_write ON public.measurements FOR ALL TO owuja_runtime
  USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = "customerId" AND owuja_security.house_member(c."fashionHouseId")))
  WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = "customerId" AND owuja_security.house_member(c."fashionHouseId")));

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_orders ON public.orders TO owuja_runtime
  USING (owuja_security.house_member("fashionHouseId") OR owuja_security.customer_access("customerId"))
  WITH CHECK ((owuja_security.house_member("fashionHouseId") OR owuja_security.customer_access("customerId"))
    AND owuja_security.order_links("customerId", "fashionHouseId", "staffId", "bookingId"));

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_invoices_read ON public.invoices FOR SELECT TO owuja_runtime USING (owuja_security.order_access("orderId"));
CREATE POLICY owuja_invoices_write ON public.invoices FOR ALL TO owuja_runtime
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = "orderId" AND owuja_security.house_member(o."fashionHouseId")))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = "orderId" AND owuja_security.house_member(o."fashionHouseId")));

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_catalog_read ON public.catalog_items FOR SELECT TO owuja_runtime USING (owuja_security.actor() IS NOT NULL);
CREATE POLICY owuja_catalog_write ON public.catalog_items FOR ALL TO owuja_runtime
  USING (owuja_security.house_member("fashionHouseId")) WITH CHECK (owuja_security.house_member("fashionHouseId"));

ALTER TABLE public.available_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_slots_read ON public.available_slots FOR SELECT TO owuja_runtime USING (owuja_security.actor() IS NOT NULL);
CREATE POLICY owuja_slots_insert ON public.available_slots FOR INSERT TO owuja_runtime WITH CHECK (owuja_security.house_member("fashionHouseId"));
CREATE POLICY owuja_slots_delete ON public.available_slots FOR DELETE TO owuja_runtime USING (owuja_security.house_member("fashionHouseId"));
CREATE POLICY owuja_slots_update ON public.available_slots FOR UPDATE TO owuja_runtime
  USING (owuja_security.house_member("fashionHouseId") OR owuja_security.slot_booking_owner(id)
    OR (current_setting('owuja.role', TRUE) = 'customer' AND active AND NOT booked))
  WITH CHECK (owuja_security.house_member("fashionHouseId") OR owuja_security.slot_booking_owner(id)
    OR (current_setting('owuja.role', TRUE) = 'customer' AND active AND booked));

-- Customers can reserve/release slots, but cannot change their timing or owner.
CREATE FUNCTION owuja_security.protect_slot_details() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('owuja.role', TRUE) = 'customer' AND
    (NEW."fashionHouseId", NEW.date, NEW.time, NEW."startsAt", NEW."endsAt", NEW."durationMinutes", NEW.active)
      IS DISTINCT FROM (OLD."fashionHouseId", OLD.date, OLD.time, OLD."startsAt", OLD."endsAt", OLD."durationMinutes", OLD.active) THEN
    RAISE EXCEPTION 'Fitting slot details cannot be changed by a customer' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION owuja_security.protect_slot_details() FROM PUBLIC;
CREATE TRIGGER owuja_protect_slot_details BEFORE UPDATE ON public.available_slots
  FOR EACH ROW EXECUTE FUNCTION owuja_security.protect_slot_details();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_bookings ON public.bookings TO owuja_runtime
  USING (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId"))
  WITH CHECK ((owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId"))
    AND ("availableSlotId" IS NULL OR EXISTS (SELECT 1 FROM public.available_slots s WHERE s.id = "availableSlotId" AND s."fashionHouseId" = bookings."fashionHouseId")));

ALTER TABLE public.chat_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_escalations ON public.chat_escalations TO owuja_runtime
  USING (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId"))
  WITH CHECK (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId"));

ALTER TABLE public.sketches ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_sketches ON public.sketches TO owuja_runtime
  USING (owuja_security.house_member("fashionHouseId")) WITH CHECK (owuja_security.house_member("fashionHouseId"));

ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_preferences ON public.customer_preferences TO owuja_runtime
  USING ("userId" = owuja_security.actor()) WITH CHECK ("userId" = owuja_security.actor());

ALTER TABLE public.mood_board_sketches ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_moodboard ON public.mood_board_sketches TO owuja_runtime
  USING (owuja_security.creator_access("staffId")) WITH CHECK (owuja_security.creator_access("staffId"));

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_chat_sessions ON public.chat_sessions TO owuja_runtime
  USING (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId"))
  WITH CHECK (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId"));

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_direct_messages ON public.direct_messages TO owuja_runtime
  USING (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId", TRUE))
  WITH CHECK (owuja_security.customer_actor("customerId") OR owuja_security.house_member("fashionHouseId", TRUE));

ALTER TABLE public.direct_message_thread_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_thread_states ON public.direct_message_thread_states TO owuja_runtime
  USING ("userId" = owuja_security.actor()) WITH CHECK ("userId" = owuja_security.actor());
ALTER TABLE public.direct_message_user_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owuja_message_deletions ON public.direct_message_user_deletions TO owuja_runtime
  USING ("userId" = owuja_security.actor()) WITH CHECK ("userId" = owuja_security.actor());

-- Waitlist/code processing and counters are accessed only by the privileged
-- identity connection, not by the business runtime role.
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.waitlist_entries, public.rate_limit_buckets FROM owuja_runtime;
COMMIT;
