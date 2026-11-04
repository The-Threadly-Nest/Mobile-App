import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Explicitly opt in with a development/ephemeral database owner connection.
// Every schema, role and fixture change is rolled back, including on failure.
test("PostgreSQL row policies isolate tenants and reject cross-house writes", {
  skip: !process.env.SECURITY_TEST_DATABASE_URL,
}, async () => {
  const pool = new Pool({ connectionString: process.env.SECURITY_TEST_DATABASE_URL, connectionTimeoutMillis: 10_000 });
  const connection = await pool.connect();
  const migration = (name: string) => readFileSync(resolve(__dirname, "../prisma/migrations", name, "migration.sql"), "utf8")
    .replace(/^BEGIN;\s*$/gm, "").replace(/^COMMIT;\s*$/gm, "");
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='30s'");
    const waitlist = await connection.query("SELECT to_regclass('public.waitlist_entries') AS relation");
    if (!waitlist.rows[0].relation) {
      await connection.query(migration("20261101000000_add_waitlist"));
      await connection.query(migration("20261101010000_waitlist_email_verification"));
    }
    const fields = await connection.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='emailVerifiedAt'");
    if (!fields.rowCount) await connection.query(migration("20261103000000_separate_account_verification"));
    const policies = await connection.query("SELECT to_regnamespace('owuja_security') AS namespace");
    if (!policies.rows[0].namespace) await connection.query(migration("20261103010000_database_row_policies"));

    const ids = Object.fromEntries(["adminA", "adminB", "customerA", "customerB", "houseA", "houseB", "crmA", "crmB", "orderA", "orderB"].map((key) => [key, randomUUID()]));
    for (const key of ["adminA", "adminB", "customerA", "customerB"]) {
      await connection.query('INSERT INTO users(id,email,role,active,"emailVerifiedAt","updatedAt") VALUES($1,$2,$3,TRUE,NOW(),NOW())',
        [ids[key], `${ids[key]}@example.invalid`, key.startsWith("admin") ? "admin" : "customer"]);
    }
    for (const suffix of ["A", "B"]) {
      await connection.query('INSERT INTO fashion_houses(id,"adminId","shopName","updatedAt") VALUES($1,$2,$3,NOW())', [ids[`house${suffix}`], ids[`admin${suffix}`], "Security fixture"]);
      await connection.query('INSERT INTO customers(id,"fashionHouseId","userId",name,"updatedAt") VALUES($1,$2,$3,$4,NOW())', [ids[`crm${suffix}`], ids[`house${suffix}`], ids[`customer${suffix}`], "Security fixture"]);
      await connection.query('INSERT INTO orders(id,"fashionHouseId","customerId","itemName",price,"updatedAt") VALUES($1,$2,$3,$4,100,NOW())', [ids[`order${suffix}`], ids[`house${suffix}`], ids[`crm${suffix}`], "Security fixture"]);
    }
    await connection.query("SET LOCAL ROLE owuja_runtime");
    const actor = async (userId: string, role: string, house = "") => connection.query(
      "SELECT set_config('owuja.user_id',$1,true),set_config('owuja.role',$2,true),set_config('owuja.house_id',$3,true)", [userId, role, house]);
    const orders = async () => connection.query("SELECT id FROM orders WHERE id=ANY($1::text[])", [[ids.orderA, ids.orderB]]);

    await actor(ids.customerA, "customer");
    assert.deepEqual((await orders()).rows.map((row) => row.id), [ids.orderA]);
    const changed = await connection.query("UPDATE orders SET status=$1 WHERE id=$2 RETURNING id", ["cancelled", ids.orderB]);
    assert.equal(changed.rowCount, 0);
    await connection.query("SAVEPOINT invalid_link");
    await assert.rejects(connection.query('INSERT INTO orders(id,"fashionHouseId","customerId","itemName",price,"updatedAt") VALUES($1,$2,$3,$4,100,NOW())',
      [randomUUID(), ids.houseB, ids.crmA, "Invalid cross-house fixture"]), (error: any) => error.code === "42501");
    await connection.query("ROLLBACK TO SAVEPOINT invalid_link");
    await actor(ids.adminA, "admin", ids.houseA);
    assert.deepEqual((await orders()).rows.map((row) => row.id), [ids.orderA]);
    await actor(ids.adminB, "admin", ids.houseB);
    assert.deepEqual((await orders()).rows.map((row) => row.id), [ids.orderB]);
    await actor("", "");
    assert.equal((await orders()).rowCount, 0);
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
    await pool.end();
  }
});
