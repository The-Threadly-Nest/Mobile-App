import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { ChatService } = require("../dist/src/modules/messaging/chat.service");
const { sendChatMessageSchema } = require("../dist/src/schemas/chat.schema");
const model = require("../dist/src/lib/gemini");
const notifications = require("../dist/src/lib/notifications");

test("onboarding validates custom categories and persists them in create and update", async () => {
  const { adminOnboardingSchema } = require("../dist/src/schemas/admin.schema");
  const { FashionHouseAdminService } = require("../dist/src/modules/fashion-houses/admin.service");
  const payload = { shopName: "Atelier", location: "Lagos", categories: [" Leatherwork "], availableSlots: [{ date: "2030-01-01", time: "10:00" }] };
  const body = adminOnboardingSchema.parse(payload);
  assert.deepEqual(body.categories, ["Leatherwork"]);
  assert.equal(adminOnboardingSchema.safeParse({ ...payload, categories: [" "] }).success, false);
  assert.equal(adminOnboardingSchema.safeParse({ ...payload, categories: ["x".repeat(101)] }).success, false);
  let saved: any;
  const tx = {
    fashionHouse: {
      upsert: async ({ where, create, update }: any) => {
        assert.equal(where.adminId, "admin");
        assert.deepEqual(create.categories, ["Leatherwork"]);
        assert.deepEqual(update.categories, ["Leatherwork"]);
        saved = { id: "house", ...update }; return saved;
      },
      findUniqueOrThrow: async () => saved,
    },
    availableSlot: { findMany: async () => [], deleteMany: async () => ({}), createMany: async () => ({ count: 1 }) },
  };
  const service = new FashionHouseAdminService({ client: { $transaction: async (fn: any) => fn(tx) } });
  const result = await service.putOnboarding({ authUserId: "admin", body });
  assert.deepEqual(result.fashionHouse.categories, ["Leatherwork"]);
});

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
  const house = { id: "house", shopName: "Atelier", categories: ["Agbada & Native"], catalogItems: [], availableSlots: [slot], timezone: "Africa/Lagos" };
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
  let expectedGarment = "Evening dress";
  model.getModel = () => ({ startChat: ({ systemInstruction }: any) => {
    providerCalls++; assert.ok(systemInstruction.parts[0].text.includes(expectedGarment));
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
  await assert.rejects(service.postMessage({ ...input, body: { ...input.body, specialization: "Agbada & Native" } }), (e: any) => e.getStatus() === 400);
  saved = null;
  expectedGarment = "Agbada & Native";
  const specializationInput = { ...input, body: { fashionHouseId: "house", message: "Book this time", specialization: "Agbada & Native", availableSlotId: "slot" }, headers: { "idempotency-key": "book:specialization" } };
  await assert.rejects(service.postMessage({ ...specializationInput, body: { ...specializationInput.body, specialization: "Bridal" } }), (e: any) => e.getStatus() === 400);
  const specialized = await service.postMessage(specializationInput);
  assert.equal(specialized.type, "booking_created");
  assert.equal(saved.styleNotes, "Agbada & Native");
  assert.equal(saved.purpose, "measurement");
  assert.equal(saved.catalogItemId, undefined);
  // A saved custom specialization follows exactly the same booking contract.
  house.categories.push("Leatherwork");
  saved = null;
  expectedGarment = "Leatherwork";
  const custom = await service.postMessage({ ...specializationInput, body: { ...specializationInput.body, specialization: "Leatherwork" }, headers: { "idempotency-key": "book:custom-specialization" } });
  assert.equal(custom.type, "booking_created");
  assert.equal(saved.styleNotes, "Leatherwork");
  assert.equal(saved.purpose, "measurement");
});
