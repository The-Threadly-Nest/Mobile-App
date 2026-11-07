import { z } from "zod";

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00 or 17:30.");
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a real date in YYYY-MM-DD format.");

export const bookingScheduleSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1, "Select at least one working day.").max(7).transform(days => [...new Set(days)].sort()),
  startTime: clockTime,
  endTime: clockTime,
  durationMinutes: z.number().int().min(60).max(300).refine(value => value % 60 === 0, "Choose a fitting duration from 1 to 5 whole hours."),
  blockedDates: z.array(calendarDate).max(60).default([]).transform(dates => [...new Set(dates)].sort()),
}).superRefine((value, ctx) => {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  if (minutes(value.endTime) - minutes(value.startTime) < value.durationMinutes) {
    ctx.addIssue({ code: "custom", path: ["endTime"], message: "Closing time must allow at least one full fitting after opening time." });
  }
});

export const saveBookingScheduleSchema = z.object({
  schedule: bookingScheduleSchema,
  timezone: z.string().trim().min(1).max(100),
});

export const createAvailableSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  durationMinutes: z.number().int().min(15).max(480).optional(),
});

export const updateAvailableSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  active: z.boolean().optional(),
  booked: z.boolean().optional(),
});
