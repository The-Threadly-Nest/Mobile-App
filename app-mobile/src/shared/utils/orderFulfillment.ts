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
  { step: 3, label: "Preparing order" },
  { step: 4, label: "Ready for Pickup" },
  { step: 5, label: "Completed" },
];

export const READY_CUSTOMER_STAGES = [
  { key: "order_placed", label: "Order placed", desc: "Waiting for the fashion house to accept your order" },
  { key: "in_production", label: "Preparing your order", desc: "Your selected items are being checked and packed" },
  { key: "ready_for_pickup", label: "Ready for pickup", desc: "Collect your order from the fashion house" },
  { key: "completed", label: "Completed", desc: "Your order has been collected" },
];

export function readyCustomerStage(status: string): number {
  if (["completed", "delivered"].includes(status)) return 3;
  if (["ready", "ready_for_pickup"].includes(status)) return 2;
  if (["in_production", "fabric_sourced", "quality_check", "assigned", "active"].includes(status)) return 1;
  return 0;
}
