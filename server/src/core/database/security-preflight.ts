import { identityPrisma, runtimePrisma } from "../../lib/prisma";

export async function verifyDatabaseSecurity(): Promise<void> {
  const enabled = process.env.DATABASE_RLS_ENABLED === "true";
  if (process.env.NODE_ENV === "production" && !enabled) {
    throw new Error("Production requires DATABASE_RLS_ENABLED=true with a restricted runtime database login.");
  }
  if (!enabled) return;
  if (!process.env.IDENTITY_DATABASE_URL || process.env.IDENTITY_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("Row security requires a separate IDENTITY_DATABASE_URL. Never use the database owner as the runtime login.");
  }
  // Validate and warm the private credential connection before the first login.
  const identity = await identityPrisma.$queryRaw<Array<{ privileged: boolean }>>`
    SELECT (r.rolbypassrls OR r.rolsuper OR EXISTS (
      SELECT 1 FROM pg_class c WHERE c.oid = 'public.users'::regclass AND c.relowner = r.oid
    )) AS privileged FROM pg_roles r WHERE r.rolname = current_user
  `;
  if (!identity[0]?.privileged) throw new Error("IDENTITY_DATABASE_URL must use the private migration/identity owner connection.");
  const roles = await runtimePrisma.$queryRaw<Array<{ bypass: boolean; superuser: boolean; createRole: boolean; createDb: boolean; owner: boolean; member: boolean }>>`
    SELECT r.rolbypassrls AS bypass, r.rolsuper AS superuser, r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDb",
      EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND c.relowner = r.oid) AS owner,
      pg_has_role(current_user, 'owuja_runtime', 'USAGE') AS member
    FROM pg_roles r WHERE r.rolname = current_user
  `;
  const role = roles[0];
  if (!role || role.bypass || role.superuser || role.createRole || role.createDb || role.owner || !role.member) {
    throw new Error("The runtime database login must be a non-owner member of owuja_runtime, without SUPERUSER or BYPASSRLS.");
  }
  const tables = await runtimePrisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean }>>`
    SELECT relname::text AS relname, relrowsecurity FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  `;
  const required = ["users", "fashion_houses", "customers", "measurements", "orders", "invoices", "catalog_items", "available_slots", "bookings", "chat_escalations", "sketches", "customer_preferences", "mood_board_sketches", "chat_sessions", "direct_messages", "direct_message_thread_states", "direct_message_user_deletions", "waitlist_entries", "rate_limit_buckets"];
  if (required.some((name) => !tables.some((table) => table.relname === name && table.relrowsecurity))) {
    throw new Error("Database row policies are not installed. Apply the reviewed security migrations before enabling production.");
  }
}
