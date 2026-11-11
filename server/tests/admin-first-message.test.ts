import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { DirectMessagesService } = require("../dist/src/modules/messaging/direct-messages.service");
const notifications = require("../dist/src/lib/notifications");

test("admin can start a first conversation with a linked CRM customer, without any prior messages", async t => {
  const previousNotify = notifications.sendNotificationToUser;
  const notified: any[] = [];
  notifications.sendNotificationToUser = async (...args: any[]) => { notified.push(args); };
  t.after(() => { notifications.sendNotificationToUser = previousNotify; });
  let saved: any = null, creates = 0;
  const service = new DirectMessagesService({ client: {
    customer: { findFirst: async ({ where }: any) => {
      assert.equal(where.fashionHouseId, "house");
      if (where.id === "crm") return { id: "crm", userId: "account" };
      if (where.id === "walk-in") return { id: "walk-in", userId: null };
      return where.userId === "account" ? { id: "crm" } : null;
    } },
    user: { findFirst: async ({ where }: any) => where.id === "account" && !where.OR && where.active === true ? { id: "account" } : null },
    directMessage: { findUnique: async () => saved, create: async ({ data }: any) => { creates++; saved = { id: "message", ...data, sender: { name: "Admin" } }; return saved; } },
    chatEscalation: { updateMany: async () => ({ count: 0 }) },
    fashionHouse: { findUnique: async () => ({ shopName: "Atelier" }) },
  } });
  const input = { authUserId: "admin", authRole: "admin", authFashionHouseId: "house", params: { fashionHouseId: "crm" }, body: { text: "Hello, your fitting is ready.", clientMessageId: "first:message" } };
  const result = await service.postThreadByFashionHouseId(input);
  assert.equal(result.data.customerId, "account");
  assert.equal(notified[0][0], "account");
  await service.postThreadByFashionHouseId(input);
  assert.equal(creates, 1);
  assert.equal(notified.length, 1);
  await assert.rejects(service.postThreadByFashionHouseId({ ...input, params: { fashionHouseId: "walk-in" } }), (e: any) => e.status === 409);
  await assert.rejects(service.postThreadByFashionHouseId({ ...input, params: { fashionHouseId: "unrelated-account" } }), (e: any) => e.status === 403);
});
