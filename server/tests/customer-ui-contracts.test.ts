import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { ChatService } = require("../dist/src/modules/messaging/chat.service");
const { MeasurementsService } = require("../dist/src/modules/customers/measurements.service");
const { serializeChatSlot } = require("../dist/src/lib/availability");
test("chat slot metadata contains the house-local date and time for two-step selection", () => {
  const slot = { id: "slot", date: "2030-01-01", time: "10:00", startsAt: new Date("2030-01-01T09:00:00Z") };
  const output = serializeChatSlot(slot, "Africa/Lagos");
  assert.equal(output.date, "2030-01-01");
  assert.equal(output.time, "10:00");
  assert.equal(output.timezone, "Africa/Lagos");
  assert.match(output.label, /10:00/);
});
test("booking session exposes all published date options, not only the first ten times", async () => {
  let args: any;
  const slots = Array.from({ length: 12 }, (_, i) => ({ id: "slot-" + i, date: "2030-01-" + String(i + 1).padStart(2, "0"), time: "10:00", startsAt: new Date(`2030-01-${String(i + 1).padStart(2, "0")}T09:00:00Z`) }));
  const service = new ChatService({ client: {
    user: { findUnique: async () => ({ id: "customer", role: "customer" }) },
    chatSession: { findUnique: async () => null },
    availableSlot: { findMany: async (input: any) => { args = input; return slots; } },
    chatEscalation: { findUnique: async () => null },
    fashionHouse: { findUnique: async () => ({ timezone: "Africa/Lagos" }) },
  } });
  const response = await service.getSessionByFashionHouseId({ authUserId: "customer", params: { fashionHouseId: "house" } });
  assert.equal(response.availableSlots.length, 12);
  assert.equal(response.availableSlots[11].date, "2030-01-12");
  assert.equal(args.take, 1000);
  assert.equal(args.where.fashionHouseId, "house");
  assert.equal(args.where.booked, false);
  assert.equal(args.where.active, true);
  assert.ok(args.where.startsAt.gt instanceof Date);
});
test("customer measurement grouping metadata is read only for the authenticated customer's records", async () => {
  let args: any;
  const service = new MeasurementsService({ client: { measurement: { findMany: async (input: any) => { args = input; return []; } } } });
  assert.deepEqual(await service.getMyMeasurements({ authUserId: "customer" }), []);
  assert.deepEqual(args.where, { customer: { userId: "customer" } });
  assert.deepEqual(args.include.customer.select.fashionHouse.select, { id: true, shopName: true });
});
