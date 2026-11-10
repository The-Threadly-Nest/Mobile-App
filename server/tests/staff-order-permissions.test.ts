import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { OrdersService } = require("../dist/src/modules/orders/orders.service");
const { EscalationsService } = require("../dist/src/modules/messaging/escalations.service");
const { inviteStaffSchema } = require("../dist/src/schemas/staff.schema");

test("assignment requires an activated staff member in the same house", async () => {
  let writes = 0;
  const service = new OrdersService({ client: {
    order: { findFirst: async () => ({ id: "order" }), update: async () => { writes++; } },
    user: { findFirst: async ({ where }: any) => { assert.equal(where.active, true); assert.equal(where.fashionHouseId, "house"); return null; } },
  } });
  await assert.rejects(service.patchByIdAssign({ authUserId: "admin", authRole: "admin", authFashionHouseId: "house", params: { id: "order" }, body: { staffId: "inactive" } }), (error: any) => error.getStatus() === 400);
  assert.equal(writes, 0);
  const escalation = new EscalationsService({ client: {} });
  escalation.getAdminFashionHouseOrThrow = async () => ({ id: "house" });
  await assert.rejects(escalation.postAssign({ authUserId: "admin", body: { customerName: "Customer" } }), (error: any) => error.getStatus() === 400);
});

test("only assigned staff update custom-fit; only admins update ready-to-wear", async () => {
  let writes = 0;
  const custom = { id: "order", staffId: "staff", items: null, bookingId: null, customer: { userId: null } };
  let current: any = custom;
  const service = new OrdersService({ client: { order: {
    findFirst: async () => current,
    update: async ({ data }: any) => { writes++; return { ...current, ...data }; },
  } } });
  const input = (role: string, id: string) => ({ authUserId: id, authRole: role, authFashionHouseId: "house", params: { id: "order" }, body: { status: "in_production" } });
  await assert.rejects(service.patchByIdStatus(input("admin", "admin")), (e: any) => e.getStatus() === 403);
  await assert.rejects(service.patchByIdStatus(input("staff", "other")), (e: any) => e.getStatus() === 403);
  await service.patchByIdStatus(input("staff", "staff"));
  current = { ...custom, items: [{ selectedSize: "M" }] };
  await assert.rejects(service.patchByIdStatus(input("staff", "staff")), (e: any) => e.getStatus() === 403);
  await service.patchByIdStatus(input("admin", "admin"));
  assert.equal(writes, 2);
});

test("optional invitation password is validated, not an activation bypass", () => {
  assert.equal(inviteStaffSchema.parse({ name: "Staff", email: "staff@example.invalid", password: "ExamplePass8" }).password, "ExamplePass8");
  assert.throws(() => inviteStaffSchema.parse({ name: "Staff", email: "staff@example.invalid", password: "weak" }));
});
