import type { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { bookingScheduleSchema } from "../schemas/slots.schema";
import { slotsOverlap, zonedDateTimeToUtc } from "./availability";

export type BookingSchedule = z.infer<typeof bookingScheduleSchema>;
export const BOOKING_WINDOW_DAYS = 30;

export function generateWeeklySlots(schedule: BookingSchedule, timezone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map(part => [part.type, part.value]));
  const firstDate = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const slots: { date: string; time: string; startsAt: Date; endsAt: Date; durationMinutes: number }[] = [];
  let generatedThrough = "";
  for (let day = 0; day < BOOKING_WINDOW_DAYS; day++) {
    const local = new Date(firstDate.getTime() + day * 86400000);
    const date = local.toISOString().slice(0, 10);
    generatedThrough = date;
    if (!schedule.days.includes(local.getUTCDay()) || schedule.blockedDates.includes(date)) continue;
    for (let minute = toMinutes(schedule.startTime); minute + schedule.durationMinutes <= toMinutes(schedule.endTime); minute += schedule.durationMinutes) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      let startsAt: Date, windowEnd: Date;
      try {
        startsAt = zonedDateTimeToUtc(date, time, timezone);
        windowEnd = zonedDateTimeToUtc(date, schedule.endTime, timezone);
      } catch { continue; /* Skip local clock times that do not exist during a DST transition. */ }
      const endsAt = new Date(startsAt.getTime() + schedule.durationMinutes * 60000);
      if (startsAt <= now || endsAt > windowEnd) continue;
      if (slots.some(slot => slotsOverlap(startsAt, schedule.durationMinutes, slot))) continue;
      slots.push({ date, time, startsAt, endsAt, durationMinutes: schedule.durationMinutes });
    }
  }
  return { slots, generatedThrough };
}

// Called only inside an authenticated administrator's transaction. Never uses
// the identity connection or bypasses tenant/row permissions.
export async function replaceWeeklyAvailability(tx: Prisma.TransactionClient, fashionHouseId: string, schedule: BookingSchedule, timezone: string, now = new Date()) {
  const { slots, generatedThrough } = generateWeeklySlots(schedule, timezone, now);
  const protectedSlots = await tx.availableSlot.findMany({
    where: { fashionHouseId, startsAt: { gte: new Date(now.getTime() - 480 * 60000) }, OR: [{ booked: true }, { booking: { isNot: null } }] },
    select: { startsAt: true, durationMinutes: true },
  });
  const available = slots.filter(slot => !protectedSlots.some(booked => slotsOverlap(slot.startsAt, slot.durationMinutes, booked)));
  // Replace future unbooked availability, not historic or booked appointments.
  await tx.availableSlot.deleteMany({ where: { fashionHouseId, booked: false, booking: { is: null }, startsAt: { gt: now } } });
  const created = await tx.availableSlot.createMany({ data: available.map(slot => ({ ...slot, fashionHouseId, active: true, booked: false })), skipDuplicates: true });
  const savedSchedule = { ...schedule, generatedThrough };
  await tx.fashionHouse.update({ where: { id: fashionHouseId }, data: { bookingSchedule: savedSchedule, slotDurationMinutes: schedule.durationMinutes, timezone } });
  return { schedule: savedSchedule, created: created.count, skippedBooked: slots.length - available.length };
}
