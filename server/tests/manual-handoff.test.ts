import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { ChatService } = require("../dist/src/modules/messaging/chat.service");
const notifications = require("../dist/src/lib/notifications");

test("manual handoff creates one admin inbox message, never an order or appointment", async (t) => {
  const original = notifications.sendNotificationToAdmin;
  notifications.sendNotificationToAdmin = async () => {};
  t.after(() => { notifications.sendNotificationToAdmin = original; });
  let escalation: any = null;
  const messages: any[] = [];
  const forbidden = () => assert.fail("Support must not create an order or booking");
  const transaction = {
    chatEscalation: { create: async ({ data }: any) => (escalation = { id: "handoff", ...data }) },
    chatSession: { update: async () => ({}) },
    directMessage: { create: async ({ data }: any) => { messages.push(data); return { id: "message", ...data }; } },
    booking: { create: forbidden }, order: { create: forbidden },
  };
  const service = new ChatService({ client: {
    user: { findUnique: async () => ({ id: "customer", role: "customer" }) },
    fashionHouse: { findUnique: async () => ({ id: "house" }) },
    chatSession: { upsert: async () => ({ id: "session", history: [] }) },
    chatEscalation: { findUnique: async () => escalation },
    $transaction: async (work: any) => work(transaction),
    booking: { create: forbidden }, order: { create: forbidden },
  } });
  const input = { authUserId: "customer", authRole: "customer", body: { fashionHouseId: "house", reason: "Customer initiated manual escalation" }, params: {}, query: {}, headers: {} };
  const response = await service.postEscalate(input);
  assert.equal(response.type, "escalated");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].fashionHouseId, "house");
  assert.equal(messages[0].customerId, "customer");
  assert.equal(messages[0].senderRole, "customer");
  assert.equal(messages[0].clientMessageId, "handoff:handoff");
  assert.match(messages[0].text, /speak with the fashion house team/);
  await service.postEscalate(input);
  assert.equal(messages.length, 1, "retry reuses the active handoff without another inbox message");
});
