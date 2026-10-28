type SlotLike = {
  id: string;
  date: string;
  time: string;
  startsAt: Date | null;
  durationMinutes: number;
  booked: boolean;
  active: boolean;
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-NG", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string): Date {
  if (!isValidTimeZone(timeZone)) throw new Error("The fashion house timezone is invalid.");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  let candidate = new Date(desiredAsUtc);
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
    );
    const renderedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute)
    );
    candidate = new Date(candidate.getTime() + desiredAsUtc - renderedAsUtc);
  }

  const roundTrip = formatter.formatToParts(candidate);
  const finalParts = Object.fromEntries(
    roundTrip.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  if (
    Number(finalParts.year) !== year || Number(finalParts.month) !== month || Number(finalParts.day) !== day ||
    Number(finalParts.hour) !== hour || Number(finalParts.minute) !== minute
  ) {
    throw new Error("That local time does not exist in the fashion house timezone.");
  }
  return candidate;
}

export function formatSlotLabel(startsAt: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startsAt);
}

export function serializeSlot<T extends SlotLike>(slot: T, timeZone: string) {
  return {
    ...slot,
    startsAt: slot.startsAt?.toISOString() ?? null,
    timezone: timeZone,
    label: slot.startsAt ? formatSlotLabel(slot.startsAt, timeZone) : `${slot.date} · ${slot.time}`,
  };
}

export function slotsOverlap(
  startsAt: Date,
  durationMinutes: number,
  other: { startsAt: Date | null; durationMinutes: number }
): boolean {
  if (!other.startsAt) return false;
  const end = startsAt.getTime() + durationMinutes * 60_000;
  const otherEnd = other.startsAt.getTime() + other.durationMinutes * 60_000;
  return startsAt.getTime() < otherEnd && other.startsAt.getTime() < end;
}

export function isAvailabilityConflictError(error: unknown): boolean {
  const text = String(
    (error as { message?: unknown; meta?: unknown })?.message ??
    JSON.stringify((error as { meta?: unknown })?.meta ?? error)
  );
  return text.includes("available_slots_no_active_overlap") || text.includes("23P01");
}
