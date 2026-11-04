import "dotenv/config";
import { Client } from "pg";

// Used only in Railway's pre-deploy step, after migrations. Never logs URLs/passwords.
async function provision() {
  const ownerUrl = process.env.DIRECT_URL;
  const runtimeUrl = process.env.DATABASE_URL;
  if (!ownerUrl || !runtimeUrl) throw new Error("Configure DIRECT_URL and the restricted DATABASE_URL before deployment.");
  const owner = new URL(ownerUrl);
  const runtime = new URL(runtimeUrl);
  if (decodeURIComponent(runtime.username) !== "owuja_app" || owner.username === runtime.username
    || owner.hostname !== runtime.hostname || owner.port !== runtime.port || owner.pathname !== runtime.pathname) {
    throw new Error("DATABASE_URL must use owuja_app on the same database/host/port as DIRECT_URL.");
  }
  const password = decodeURIComponent(runtime.password);
  if (password.length < 32) throw new Error("The runtime database password must contain at least 32 random characters.");
  const client = new Client({ connectionString: ownerUrl, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = 'owuja_app'");
    if (!existing.rowCount) {
      // PostgreSQL role DDL does not accept parameter placeholders. Escape the
      // secret as an SQL literal, with standard-conforming strings forced on.
      await client.query("SET LOCAL standard_conforming_strings = on");
      const literal = "'" + password.replace(/'/g, "''") + "'";
      await client.query(`CREATE ROLE owuja_app LOGIN PASSWORD ${literal} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    } else {
      const role = existing.rows[0];
      if (!role.rolcanlogin || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolreplication) {
        throw new Error("The existing owuja_app login has unsafe privileges. Review it before redeploying.");
      }
      // Do not silently rotate an existing login's password on each deployment.
    }
    await client.query("GRANT owuja_runtime TO owuja_app");
    const database = decodeURIComponent(runtime.pathname.slice(1)).replace(/"/g, '""');
    await client.query(`GRANT CONNECT ON DATABASE "${database}" TO owuja_app`);
    await client.query("COMMIT");
    console.log("The restricted application database login is ready.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { await client.end(); }
}

provision().catch(() => {
  // pg errors can contain connection details. Keep deployment output private.
  console.error("Database login setup failed. Check the private database settings and role permissions before retrying.");
  process.exitCode = 1;
});
