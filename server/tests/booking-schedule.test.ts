import assert from "node:assert/strict";
import test from "node:test";
import { bookingScheduleSchema, saveBookingScheduleSchema } from "../src/schemas/slots.schema";
import { generateWeeklySlots, replaceWeeklyAvailability } from "../src/lib/booking-schedule";

const now = new Date("2026-11-07T08:00:00Z");
const rules = () => bookingScheduleSchema.parse({ days: [1, 3, 5], startTime: "09:00", endTime: "12:00", durationMinutes: 60, blockedDates: ["2026-11-09"] });

test("weekly availability only generates selected days, full fittings and dates within the 30-day window", () => {
  const result = generateWeeklySlots(rules(), "Africa/Lagos", now);
  assert.equal(result.generatedThrough, "2026-12-06");
  assert.ok(result.slots.length > 0);
  for (const slot of result.slots) {
    assert.ok([1, 3, 5].includes(new Date(slot.date + "T12:00:00Z").getUTCDay()));
    assert.notEqual(slot.date, "2026-11-09");
    assert.ok(["09:00", "10:00", "11:00"].includes(slot.time));
    assert.ok(slot.startsAt > now);
    assert.equal(slot.endsAt.getTime() - slot.startsAt.getTime(), 3600000);
  }
  assert.equal(result.slots.find(slot => slot.date === "2026-11-11" && slot.time === "09:00")!.startsAt.toISOString(), "2026-11-11T08:00:00.000Z");
});
test("server rejects empty days, invalid times, overnight ranges, invalid dates and invalid durations", () => {
  const base = rules();
  for (const patch of [{ days: [] }, { days: [7] }, { startTime: "25:00" }, { endTime: "08:00" }, { startTime: "11:45" }, { blockedDates: ["2026-02-30"] }, { durationMinutes: 30 }, { durationMinutes: 90 }, { durationMinutes: 360 }]) {
    assert.throws(() => bookingScheduleSchema.parse({ ...base, ...patch }));
  }
  assert.deepEqual(bookingScheduleSchema.parse({ ...base, days: [1, 1, 3] }).days, [1, 3]);
  assert.throws(() => saveBookingScheduleSchema.parse({ schedule: base, timezone: "" }));
});

test("all five whole-hour fitting choices generate non-overlapping appointments within working hours", () => {
  for (const hours of [1, 2, 3, 4, 5]) {
    const schedule = bookingScheduleSchema.parse({ ...rules(), startTime: "09:00", endTime: "19:00", durationMinutes: hours * 60 });
    const result = generateWeeklySlots(schedule, "Africa/Lagos", now);
    assert.ok(result.slots.length > 0);
    for (let i = 0; i < result.slots.length; i++) {
      assert.equal(result.slots[i].durationMinutes, hours * 60);
      assert.equal(result.slots[i].endsAt.getTime() - result.slots[i].startsAt.getTime(), hours * 3600000);
      if (i > 0) assert.ok(result.slots[i].startsAt >= result.slots[i - 1].endsAt);
    }
  }
});
test("generation skips past times and does not invent nonexistent DST appointments", () => {
  const daily = bookingScheduleSchema.parse({ days: [0, 1, 2, 3, 4, 5, 6], startTime: "09:00", endTime: "12:30", durationMinutes: 60 });
  const generated = generateWeeklySlots(daily, "Africa/Lagos", new Date("2026-11-07T09:30:00Z"));
  assert.deepEqual(generated.slots.filter(slot => slot.date === "2026-11-07").map(slot => slot.time), ["11:00"]);
  const dst = generateWeeklySlots({ ...daily, days: [0], startTime: "01:00", endTime: "04:00", durationMinutes: 60 }, "America/New_York", new Date("2027-03-13T12:00:00Z"));
  assert.ok(dst.slots.filter(slot => slot.date === "2027-03-14").every(slot => !slot.time.startsWith("02:")));
  assert.equal(new Set(dst.slots.map(slot => slot.startsAt.toISOString())).size, dst.slots.length);
});
test("saving a weekly schedule scopes every query to the house and never deletes booked or linked slots", async () => {
  let deleteWhere: any, created: any[], houseUpdate: any;
  const booked = { startsAt: new Date("2026-11-11T08:30:00Z"), durationMinutes: 60 };
  const tx = {
    availableSlot: {
      findMany: async ({ where }: any) => { assert.equal(where.fashionHouseId, "own-house"); return [booked]; },
      deleteMany: async ({ where }: any) => { deleteWhere = where; return { count: 2 }; },
      createMany: async ({ data }: any) => { created = data; return { count: data.length }; },
    },
    fashionHouse: { update: async (input: any) => { houseUpdate = input; return {}; } },
  };
  const result = await replaceWeeklyAvailability(tx as any, "own-house", rules(), "Africa/Lagos", now);
  assert.equal(deleteWhere.fashionHouseId, "own-house");
  assert.equal(deleteWhere.booked, false);
  assert.deepEqual(deleteWhere.booking, { is: null });
  assert.equal(deleteWhere.startsAt.gt, now);
  assert.ok(created!.every(slot => slot.fashionHouseId === "own-house" && slot.active && !slot.booked));
  assert.ok(!created!.some(slot => slot.date === "2026-11-11" && ["09:00", "10:00"].includes(slot.time)));
  assert.equal(result.skippedBooked, 2);
  assert.equal(houseUpdate.where.id, "own-house");
  assert.equal(houseUpdate.data.bookingSchedule.generatedThrough, "2026-12-06");
});
