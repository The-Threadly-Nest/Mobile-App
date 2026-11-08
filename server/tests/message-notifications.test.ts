import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const notifications = require("../dist/src/lib/notifications");
const { identityPrisma } = require("../dist/src/lib/prisma");
const { AuthService } = require("../dist/src/modules/identity/auth.service");
const { DirectMessagesService } = require("../dist/src/modules/messaging/direct-messages.service");

test("device registration transfers an existing shared token to the signed-in account", async () => {
  const users = [{ id: "admin", pushToken: "device" }, { id: "customer", pushToken: null }];
  let locked = false;
  const tx = {
    $queryRaw: async (_sql: unknown, token: string) => { assert.equal(token, "device"); locked = true; },
    user: {
      updateMany: async ({ where, data }: any) => { assert.ok(locked); for (const user of users) if (user.pushToken === where.pushToken && user.id !== where.id.not) user.pushToken = data.pushToken; },
      update: async ({ where, data }: any) => Object.assign(users.find(user => user.id === where.id)!, data),
    },
  };
  const service = new AuthService({ identityClient: { user: { findUnique: async () => users[1] }, $transaction: async (work: any) => work(tx) } });
  const result = await service.postPushToken({ authUserId: "customer", body: { pushToken: "device" } });
  assert.equal(result.userId, "customer");
  assert.equal(users[0].pushToken, null);
  assert.equal(users[1].pushToken, "device");
});
test("push delivery excludes the sender and stale shared devices, and identifies the recipient", async (t) => {
  const originalFind = identityPrisma.user.findUnique, originalFetch = global.fetch;
  let tokens: Record<string, string> = { admin: "admin-device", customer: "customer-device" };
  const sent: any[] = [];
  identityPrisma.user.findUnique = async ({ where }: any) => ({ pushToken: tokens[where.id] });
  global.fetch = async (_url: any, options: any) => { sent.push(JSON.parse(options.body)); return new Response(JSON.stringify({ data: { status: "ok" } }), { status: 200 }); };
  t.after(() => { identityPrisma.user.findUnique = originalFind; global.fetch = originalFetch; });
  await notifications.sendNotificationToUser("admin", "Message", "hello", { senderId: "admin" });
  assert.equal(sent.length, 0);
  tokens = { admin: "same-device", customer: "same-device" };
  await notifications.sendNotificationToUser("customer", "Message", "hello", { senderId: "admin" });
  assert.equal(sent.length, 0);
  tokens.customer = "customer-device";
  await notifications.sendNotificationToUser("customer", "Message", "hello", { senderId: "admin", screen: "direct-chat" });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "customer-device");
  assert.equal(sent[0].data.recipientUserId, "customer");
  assert.equal(sent[0].data.senderId, "admin");
  assert.equal(sent[0].channelId, "default");
  assert.equal(sent[0].color, "#F96951");
});
test("direct messages notify only the other party and retries do not send another push", async (t) => {
  const oldUser = notifications.sendNotificationToUser, oldAdmin = notifications.sendNotificationToAdmin;
  const sent: any[] = [];
  notifications.sendNotificationToUser = async (...args: any[]) => { sent.push({ target: "customer", args }); };
  notifications.sendNotificationToAdmin = async (...args: any[]) => { sent.push({ target: "admin", args }); };
  t.after(() => { notifications.sendNotificationToUser = oldUser; notifications.sendNotificationToAdmin = oldAdmin; });
  for (const senderRole of ["admin", "customer"]) {
    let saved: any = null;
    const service = new DirectMessagesService({ client: {
      directMessage: { findUnique: async () => saved, create: async ({ data }: any) => { saved = { id: "message", ...data, sender: { name: senderRole } }; return saved; } },
      chatEscalation: { updateMany: async () => ({ count: 0 }) },
      fashionHouse: { findUnique: async () => ({ shopName: "Test House" }) },
    } });
    service.resolveThread = async () => ({ fashionHouseId: "house", customerId: "customer", senderRole, senderId: senderRole });
    const input = { authUserId: senderRole, params: { fashionHouseId: "house" }, body: { text: "Hello", clientMessageId: "test:message" } };
    await service.postThreadByFashionHouseId(input);
    const delivered = sent[sent.length - 1];
    assert.equal(delivered.target, senderRole === "admin" ? "customer" : "admin");
    assert.equal(delivered.args[3].senderId, senderRole);
    const count = sent.length;
    await service.postThreadByFashionHouseId(input);
    assert.equal(sent.length, count);
  }
});
