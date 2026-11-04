import "dotenv/config";
import { Client } from "pg";

class SetupError extends Error {}
let stage = "checking database variables";

function parseConnection(value, name) {
  if (!value) throw new SetupError(`Add ${name} to the backend service variables.`);
  if (value.includes("${{")) throw new SetupError(`${name} contains an unresolved Railway reference. Check the database service name.`);
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    return url;
  } catch { throw new SetupError(`${name} is not a valid PostgreSQL connection URL.`); }
}

// Used only in Railway's pre-deploy step, after migrations. Never logs URLs/passwords.
async function provision() {
  const ownerUrl = process.env.DIRECT_URL;
  const runtimeUrl = process.env.DATABASE_URL;
  const owner = parseConnection(ownerUrl, "DIRECT_URL");
  const runtime = parseConnection(runtimeUrl, "DATABASE_URL");
  if (decodeURIComponent(runtime.username) !== "owuja_app") throw new SetupError("DATABASE_URL must use the username owuja_app, not the Postgres owner login.");
  if (decodeURIComponent(owner.username) === decodeURIComponent(runtime.username)) throw new SetupError("DIRECT_URL must use the Postgres owner login, not owuja_app.");
  if (owner.hostname !== runtime.hostname) throw new SetupError("DIRECT_URL and DATABASE_URL use different hosts. Use the same Railway private database host in both.");
  if ((owner.port || "5432") !== (runtime.port || "5432")) throw new SetupError("DIRECT_URL and DATABASE_URL use different ports. Use the database's private port in both.");
  if (decodeURIComponent(owner.pathname) !== decodeURIComponent(runtime.pathname)) throw new SetupError("DIRECT_URL and DATABASE_URL point to different database names.");
  const password = decodeURIComponent(runtime.password);
  if (password.includes("YOUR_GENERATED_PASSWORD") || password.length < 32) throw new SetupError("Replace the DATABASE_URL password placeholder with at least 32 random characters.");
  const client = new Client({ connectionString: ownerUrl, connectionTimeoutMillis: 10_000 });
  try {
    stage = "connecting with DIRECT_URL";
    await client.connect();
    stage = "checking the restricted login";
    await client.query("BEGIN");
    const existing = await client.query("SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = 'owuja_app'");
    if (!existing.rowCount) {
      // PostgreSQL role DDL does not accept parameter placeholders. Escape the
      // secret as an SQL literal, with standard-conforming strings forced on.
      await client.query("SET LOCAL standard_conforming_strings = on");
      const literal = "'" + password.replace(/'/g, "''") + "'";
      stage = "creating the restricted login";
      await client.query(`CREATE ROLE owuja_app LOGIN PASSWORD ${literal} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    } else {
      const role = existing.rows[0];
      if (!role.rolcanlogin || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolreplication) {
        throw new SetupError("The existing owuja_app login has unsafe privileges. Review it before redeploying.");
      }
      // Do not silently rotate an existing login's password on each deployment.
    }
    stage = "granting the row-security role";
    await client.query("GRANT owuja_runtime TO owuja_app");
    const database = decodeURIComponent(runtime.pathname.slice(1)).replace(/"/g, '""');
    stage = "granting database access";
    await client.query(`GRANT CONNECT ON DATABASE "${database}" TO owuja_app`);
    await client.query("COMMIT");
    console.log("The restricted application database login is ready.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { await client.end(); }
}

provision().catch((error) => {
  // pg errors can contain connection details. Keep deployment output private.
  const hints = {
    "28P01": "The owner credentials in DIRECT_URL were rejected. Reference the Postgres service DATABASE_URL.",
    "42501": "The DIRECT_URL login lacks permission to create or grant roles. Use the Postgres owner connection.",
    "42704": "A required database role is missing. Run db:deploy successfully before db:provision.",
    "3D000": "The configured database does not exist. Check the database name.",
    ENOTFOUND: "The database hostname could not be resolved. Check Railway private networking and service references.",
    ECONNREFUSED: "The database refused the connection. Check that Postgres is online and the port is correct.",
    ETIMEDOUT: "The database connection timed out. Check that Postgres is online and reachable.",
  };
  const detail = error instanceof SetupError ? error.message
    : hints[error?.code] || "Check the private database settings and permissions. No connection details have been printed.";
  console.error(`Database login setup failed while ${stage}. ${detail}`);
  process.exitCode = 1;
});
