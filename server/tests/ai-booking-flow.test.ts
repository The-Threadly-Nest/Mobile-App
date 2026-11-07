import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { ChatService } = require("../dist/src/modules/messaging/chat.service");
const model = require("../dist/src/lib/gemini");
const notifications = require("../dist/src/lib/notifications");

test("AI appointment flow uses saved slots and never reports an unsaved booking as confirmed", async (t) => {
  const originalModel = model.getModel, originalNotify = notifications.sendNotificationToAdmin;
  notifications.sendNotificationToAdmin = async () => {};
  t.after(() => { model.getModel = originalModel; notifications.sendNotificationToAdmin = originalNotify; });
  const slot = { id: "slot", fashionHouseId: "house", date: "2030-01-01", time: "10:00", startsAt: new Date("2030-01-01T09:00:00Z"), durationMinutes: 60 };
  let saved: any = null, creates = 0, mode = "reply", available = true;
  let history: any[] = [];
  const house = { id: "house", shopName: "Owuja Test House", categories: ["Tailoring"], catalogItems: [], availableSlots: [slot], timezone: "Africa/Lagos" };
  const tx = {
    availableSlot: { findFirst: async (args: any) => { assert.equal(args.where.fashionHouseId, "house"); assert.equal(args.where.id, "slot"); return available ? slot : null; }, updateMany: async () => ({ count: available ? 1 : 0 }) },
    booking: { create: async (args: any) => { creates++; saved = { id: "booking", ...args.data, availableSlot: slot }; return saved; } },
  };
  const db = { client: {
    chatSession: { upsert: async () => ({ id: "session", history }), update: async (args: any) => { history = args.data.history; return { id: "session", history }; } },
    fashionHouse: { findUnique: async () => house },
    user: { findUnique: async () => ({ id: "customer", role: "customer", name: "Test Customer" }) },
    chatEscalation: { findUnique: async () => null },
    booking: { findFirst: async () => saved },
    availableSlot: { findMany: async () => [] },
    $transaction: async (work: any) => work(tx),
  } };
  const service = new ChatService(db);
  model.getModel = () => ({ startChat: (args: any) => {
    assert.ok(args.systemInstruction.parts[0].text.includes(house.shopName));
    return { sendMessage: async () => {
      if (mode === "offline") throw new Error("mock provider unavailable");
      return { response: {
        functionCalls: () => mode === "book" ? [{ name: "create_booking", args: { styleNotes: "Wedding suit", preferredDate: "2099-01-01", preferredTime: "invented time" } }] : [],
        text: () => "What garment style would you like for your wedding?",
      } };
    } };
  } });
  const input = (body: any = {}) => ({ authUserId: "customer", authRole: "customer", body: { fashionHouseId: "house", message: "A suit for a wedding", ...body }, headers: { "idempotency-key": "test:appointment" }, params: {}, query: {} });
  await t.test("assistant reply is saved and returned with real selectable slots", async () => {
    const response = await service.postMessage(input());
    assert.equal(response.type, "message");
    assert.match(response.reply, /garment style/);
    assert.equal(response.availableSlots[0].id, "slot");
    assert.equal(creates, 0);
  });
  await t.test("AI tool cannot book without a customer-selected slot", async () => {
    mode = "book";
    await assert.rejects(() => service.postMessage(input()), (error: any) => error.getStatus() === 400 && error.getResponse().code === "SLOT_REQUIRED");
    assert.equal(creates, 0);
  });
  await t.test("booking reserves the real slot, ignores invented AI dates and confirms pending review", async () => {
    const response = await service.postMessage(input({ availableSlotId: "slot" }));
    assert.equal(response.type, "booking_created");
    assert.equal(response.booking.preferredDate.getTime(), slot.startsAt.getTime());
    assert.equal(response.booking.preferredTime, "10:00");
    assert.equal(response.booking.customerId, "customer");
    assert.equal(response.booking.fashionHouseId, "house");
    assert.equal(response.booking.status, "pending_admin_review");
    assert.match(response.reply, /team will confirm/);
    assert.equal(creates, 1);
  });
  await t.test("retry returns the saved booking instead of creating another", async () => {
    history = [];
    assert.equal((await service.postMessage(input({ availableSlotId: "slot" }))).booking.id, "booking");
    assert.equal(creates, 1);
  });
  await t.test("an unavailable slot returns conflict rather than success", async () => {
    saved = null; history = []; available = false;
    await assert.rejects(() => service.postMessage(input({ availableSlotId: "slot" })), (error: any) => error.getStatus() === 409 && error.getResponse().code === "SLOT_UNAVAILABLE");
    assert.equal(creates, 1);
  });
  await t.test("provider failure explains unavailability without claiming a booking", async () => {
    mode = "offline"; history = [];
    const response = await service.postMessage(input());
    assert.equal(response.type, "message");
    assert.match(response.reply, /temporarily unavailable/);
    assert.equal(creates, 1);
  });
});
