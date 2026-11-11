import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { ChatService } = require("../dist/src/modules/messaging/chat.service");
const { sendChatMessageSchema } = require("../dist/src/schemas/chat.schema");
const model = require("../dist/src/lib/gemini");
const notifications = require("../dist/src/lib/notifications");

test("house booking accepts one garment and rejects multiple garments", () => {
  const first = "11111111-1111-4111-8111-111111111111", second = "22222222-2222-4222-8222-222222222222";
  const body = { fashionHouseId: "house", message: "Book a measurement", catalogItemIds: [first] };
  assert.equal(sendChatMessageSchema.safeParse(body).success, true);
  assert.equal(sendChatMessageSchema.safeParse({ ...body, catalogItemIds: [first, second] }).success, false);
  assert.equal(sendChatMessageSchema.safeParse({ ...body, catalogItemIds: [first, first] }).success, false);
  assert.equal(sendChatMessageSchema.safeParse({ ...body, catalogItemIds: [first, second, "33333333-3333-4333-8333-333333333333"] }).success, false);
});

test("booking checks garment ownership and stores the selected garment in its measurement appointment", async t => {
  const oldModel = model.getModel, oldNotify = notifications.sendNotificationToAdmin;
  notifications.sendNotificationToAdmin = async () => {};
  t.after(() => { model.getModel = oldModel; notifications.sendNotificationToAdmin = oldNotify; });
  const garments = [{ id: "dress", name: "Evening dress", fulfillmentType: "custom_fit", imageUrl: "https://example.invalid/dress.png", priceFrom: 20000 }];
  const slot = { id: "slot", fashionHouseId: "house", date: "2030-01-01", time: "10:00", startsAt: new Date("2030-01-01T09:00:00Z"), durationMinutes: 60 };
  const house = { id: "house", shopName: "Atelier", categories: [], catalogItems: [], availableSlots: [slot], timezone: "Africa/Lagos" };
  let availableGarments = garments, saved: any = null, providerCalls = 0;
  const db = { client: {
    chatSession: { upsert: async () => ({ id: "session", history: [] }), update: async () => ({}) },
    fashionHouse: { findUnique: async () => house },
    user: { findUnique: async () => ({ id: "customer", role: "customer", name: "Customer" }) },
    chatEscalation: { findUnique: async () => null },
    catalogItem: { findMany: async ({ where }: any) => { assert.equal(where.fashionHouseId, "house"); assert.equal(where.fulfillmentType, "custom_fit"); assert.deepEqual(where.id.in, ["dress"]); return availableGarments; } },
    booking: { findFirst: async () => saved },
    $transaction: async (fn: any) => fn({ availableSlot: { findFirst: async () => slot, updateMany: async () => ({ count: 1 }) }, booking: { create: async ({ data }: any) => { saved = { id: "booking", ...data, availableSlot: slot }; return saved; } } }),
  } };
  model.getModel = () => ({ startChat: ({ systemInstruction }: any) => {
    providerCalls++; assert.ok(systemInstruction.parts[0].text.includes("Evening dress"));
    return { sendMessage: async () => ({ response: { functionCalls: () => [{ name: "create_booking", args: { styleNotes: "An invented garment", preferredDate: "2099-01-01", preferredTime: "invented" } }], text: () => "" } }) };
  } });
  const service = new ChatService(db);
  const input = { authUserId: "customer", body: { fashionHouseId: "house", message: "Book this time", garmentName: "client supplied name", catalogItemIds: ["dress"], availableSlotId: "slot" }, headers: { "idempotency-key": "book:one-garment" } };
  availableGarments = [];
  await assert.rejects(service.postMessage(input), (e: any) => e.getStatus() === 400);
  assert.equal(providerCalls, 0);
  availableGarments = garments;
  const result = await service.postMessage(input);
  assert.equal(result.type, "booking_created");
  assert.equal(saved.styleNotes, "Evening dress");
  assert.equal(saved.purpose, "measurement");
  assert.equal(saved.catalogItemId, "dress");
  assert.equal(saved.catalogSnapshot.id, "dress");
  assert.equal(saved.availableSlotId, "slot");
});
