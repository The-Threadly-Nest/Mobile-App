type FulfillmentRecord = {
  fulfillmentType?: unknown;
  selectedSize?: unknown;
  size?: unknown;
  items?: unknown;
  catalogSnapshot?: unknown;
  order?: unknown;
};

/** Detect published fulfillment or stored checkout sizes, never garment-name guesses. */
export function isReadyToWear(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as FulfillmentRecord;
  if (record.fulfillmentType === "custom_fit") return false;
  if (["ready_to_wear", "ready_to_fit", "ready_for_pickup"].includes(String(record.fulfillmentType))) return true;
  if ([record.selectedSize, record.size].some(size => typeof size === "string" && size.trim().length > 0)) return true;
  if (Array.isArray(record.items) && record.items.length > 0) return record.items.every(item => isReadyToWear(item));
  return Boolean((record.catalogSnapshot && isReadyToWear(record.catalogSnapshot)) || (record.order && isReadyToWear(record.order)));
}

export const READY_ORDER_STAGES = [
  { step: 1, label: "Placed" },
  { step: 3, label: "Production / Sourcing" },
  { step: 4, label: "Ready for Pickup" },
  { step: 5, label: "Completed" },
];
