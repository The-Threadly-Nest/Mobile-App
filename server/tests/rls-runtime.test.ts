import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

// Explicit opt-in only. Uses the real restricted login and cleans up all fixtures.
test("restricted development login enforces isolation through Prisma and the API", {
  skip: process.env.RUN_RLS_RUNTIME_TEST !== "true", timeout: 180_000,
}, async () => {
  require("dotenv").config({ quiet: true });
  assert.equal(process.env.NODE_ENV, "development");
  assert.equal(process.env.DATABASE_RLS_ENABLED, "true");
  for (const name of ["DATABASE_URL", "IDENTITY_DATABASE_URL"]) {
    const url = new URL(process.env[name]!);
    assert.equal(url.hostname.replace("-pooler.", "."), "ep-wild-frog-aypa0dfq.c-5.us-east-2.aws.neon.tech");
    assert.equal(url.pathname, "/neondb");
  }
  const { Logger } = require("@nestjs/common");
  Logger.overrideLogger(false);
  const { createApplication } = require("../dist/src/app");
  const { identityPrisma: owner, prisma } = require("../dist/src/lib/prisma");
  const { runDatabaseRequest, setDatabaseActor } = require("../dist/src/core/database/database-context");
  const { credentialVersion } = require("../dist/src/lib/session");
  const jwt = require("jsonwebtoken");
  const names = ["adminA", "adminB", "customerA", "customerB", "staffA", "houseA", "houseB", "crmA", "crmB", "orderA", "orderB", "itemA", "itemB"];
  const ids = Object.fromEntries(names.map((name) => [name, randomUUID()]));
  const userIds = [ids.adminA, ids.adminB, ids.customerA, ids.customerB, ids.staffA];
  const orderIds = [ids.orderA, ids.orderB];
  const fixtureHash = "rls-isolation-fixture-not-a-real-password";
  const app = await createApplication();
  let seeded = false;
  try {
    await app.listen(0, "127.0.0.1");
    await owner.$transaction(async (transaction: any) => {
      for (const name of ["adminA", "adminB", "customerA", "customerB"]) await transaction.user.create({ data: {
        id: ids[name], email: `${ids[name]}@example.invalid`, name: "RLS fixture", role: name.startsWith("admin") ? "admin" : "customer",
        active: true, emailVerifiedAt: new Date(), passwordHash: fixtureHash,
      } });
      for (const suffix of ["A", "B"]) {
        await transaction.fashionHouse.create({ data: { id: ids[`house${suffix}`], adminId: ids[`admin${suffix}`], shopName: `RLS fixture ${suffix}` } });
        await transaction.customer.create({ data: { id: ids[`crm${suffix}`], fashionHouseId: ids[`house${suffix}`], userId: ids[`customer${suffix}`], name: "RLS fixture" } });
        await transaction.order.create({ data: { id: ids[`order${suffix}`], fashionHouseId: ids[`house${suffix}`], customerId: ids[`crm${suffix}`], itemName: "RLS fixture", price: 100 } });
        await transaction.catalogItem.create({ data: { id: ids[`item${suffix}`], fashionHouseId: ids[`house${suffix}`], name: "RLS fixture", imageUrl: "https://example.invalid/fixture.webp" } });
      }
      await transaction.user.create({ data: { id: ids.staffA, email: `${ids.staffA}@example.invalid`, name: "RLS fixture staff", role: "staff", fashionHouseId: ids.houseA, active: true, emailVerifiedAt: new Date(), passwordHash: fixtureHash } });
    });
    seeded = true;
    const actor = (name: string, role: string, house?: string) => ({ authUserId: ids[name], authRole: role, authFashionHouseId: house ? ids[house] : null });
    const scoped = (identity: object, work: () => Promise<any>) => runDatabaseRequest(async () => { setDatabaseActor(identity); return work(); });
    const readOrders = () => prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true } });
    const [a, b, customer] = await Promise.all([
      scoped(actor("adminA", "admin", "houseA"), readOrders),
      scoped(actor("adminB", "admin", "houseB"), readOrders),
      scoped(actor("customerA", "customer"), readOrders),
    ]);
    assert.deepEqual(a.map((row: any) => row.id), [ids.orderA]);
    assert.deepEqual(b.map((row: any) => row.id), [ids.orderB]);
    assert.deepEqual(customer.map((row: any) => row.id), [ids.orderA]);
    await assert.rejects(readOrders(), /request identity/);
    await scoped(actor("adminA", "admin", "houseA"), async () => {
      const changed = await prisma.order.updateMany({ where: { id: ids.orderB }, data: { status: "cancelled" } });
      assert.equal(changed.count, 0);
      const transactional = await prisma.$transaction((transaction: any) => transaction.order.findMany({ where: { id: { in: orderIds } }, select: { id: true } }));
      assert.deepEqual(transactional.map((row: any) => row.id), [ids.orderA]);
    });
    const address = app.getHttpServer().address();
    const request = async (path: string, name: string, role: string) => {
      const token = jwt.sign({ sub: ids[name], role, credentialVersion: credentialVersion(ids[name], fixtureHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: "5m" });
      return fetch(`http://127.0.0.1:${address.port}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    };
    let response = await request("/api/orders", "adminA", "admin");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json() as any[]).map((row) => row.id), [ids.orderA]);
    response = await request(`/api/orders/${ids.orderB}`, "adminA", "admin");
    assert.equal(response.status, 404);
    await response.text();
    response = await request("/api/staff/me", "staffA", "staff");
    assert.equal(response.status, 200);
    assert.equal((await response.json() as any).fashionHouseId, ids.houseA);
    response = await request("/api/fashion-houses", "customerA", "customer");
    assert.equal(response.status, 200);
    const houses = await response.json() as any[];
    assert.ok(houses.some((house) => house.id === ids.houseA));
    assert.ok(houses.some((house) => house.id === ids.houseB));
    response = await request("/api/catalog/marketplace", "customerA", "customer");
    assert.equal(response.status, 200);
    const items = await response.json() as any[];
    assert.ok(items.some((item) => item.id === ids.itemA));
    assert.ok(items.some((item) => item.id === ids.itemB));
  } finally {
    try {
      if (seeded) await owner.$transaction(async (transaction: any) => {
        await transaction.order.deleteMany({ where: { id: { in: orderIds } } });
        await transaction.catalogItem.deleteMany({ where: { id: { in: [ids.itemA, ids.itemB] } } });
        await transaction.customer.deleteMany({ where: { id: { in: [ids.crmA, ids.crmB] } } });
        await transaction.user.deleteMany({ where: { id: ids.staffA } });
        await transaction.fashionHouse.deleteMany({ where: { id: { in: [ids.houseA, ids.houseB] } } });
        await transaction.user.deleteMany({ where: { id: { in: userIds } } });
      });
    } finally { await app.close(); }
  }
});
