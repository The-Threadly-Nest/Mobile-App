/**
 * Deterministically generates a consistent #TFH-2XXX order number for a given order or booking ID.
 * Strips transient prefixes (e.g. "esc-") so that Bookings and Orders share the exact same order number.
 */
export function generateOrderNumber(idOrBookingId?: string): string {
  if (!idOrBookingId) return "#TFH-2000";
  if (idOrBookingId.startsWith("#TFH-")) return idOrBookingId;

  // Clean prefix if e.g. "esc-xxx" was passed so esc-123 and 123 map to identical numbers
  const cleanId = idOrBookingId.replace(/^esc-/, "");

  let hash = 0;
  for (let i = 0; i < cleanId.length; i++) {
    hash = (hash << 5) - hash + cleanId.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  const num = 2000 + (Math.abs(hash) % 900);
  return `#TFH-${num}`;
}
