import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
const { GUARDS_METADATA } = require("@nestjs/common/constants");
const { SessionGuard } = require("../dist/src/core/auth/access.guards");
const { FashionHousesController } = require("../dist/src/modules/fashion-houses/fashion-houses.controller");
const { FashionHousesService } = require("../dist/src/modules/fashion-houses/fashion-houses.service");
const { createScopedClient } = require("../dist/src/core/database/scoped-client");
const { runDatabaseRequest, setDatabaseActor } = require("../dist/src/core/database/database-context");

test("fashion-house list and detail establish a verified database identity", () => {
  for (const method of ["get", "getById"]) {
    assert.ok(Reflect.getMetadata(GUARDS_METADATA, FashionHousesController.prototype[method]).includes(SessionGuard));
  }
});
test("RLS fashion-house listing succeeds with the customer context rather than bypassing security", async () => {
  const previous = process.env.DATABASE_RLS_ENABLED;
  process.env.DATABASE_RLS_ENABLED = "true";
  let queries = 0;
  const database = { client: createScopedClient({
    fashionHouse: {},
    $transaction: async (work: any) => work({
      $queryRaw: async (_sql: unknown, userId: string, role: string) => { assert.equal(userId, "customer-id"); assert.equal(role, "customer"); },
      fashionHouse: { findMany: async () => { queries++; return []; } },
    }),
  }) };
  try {
    const service = new FashionHousesService(database);
    await assert.rejects(() => runDatabaseRequest(() => service.get({ query: { page: 1, limit: 20 } })), /verified request identity/);
    const response = await runDatabaseRequest(() => {
      setDatabaseActor({ authUserId: "customer-id", authRole: "customer" });
      return service.get({ query: { page: 1, limit: 20 } });
    });
    assert.deepEqual(response.data, []);
    assert.equal(queries, 1);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_RLS_ENABLED;
    else process.env.DATABASE_RLS_ENABLED = previous;
  }
});
