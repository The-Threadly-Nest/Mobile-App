export interface BookingSlot { id: string; label: string; date?: string; time?: string; timezone?: string }
export function groupBookingSlots(slots: BookingSlot[]) {
  const days = new Map<string, { date: string; label: string; slots: BookingSlot[] }>();
  for (const slot of slots) {
    // Older servers only return a formatted label. Keep those builds compatible.
    const legacyDate = slot.label.replace(/(?:,|\s*[·•]\s*| at )\s*\d{1,2}:\d{2}.*$/i, '').trim();
    const date = slot.date || legacyDate;
    if (!days.has(date)) days.set(date, { date, label: /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T12:00:00Z')) : date, slots: [] });
    const day = days.get(date)!;
    if (!day.slots.some(existing => existing.id === slot.id)) day.slots.push(slot);
  }
  return [...days.values()];
}
export function bookingTimeLabel(slot: BookingSlot) { return slot.time || slot.label.match(/\d{1,2}:\d{2}(?:\s*[AP]M)?/i)?.[0] || slot.label; }
