export const ORDER_STATUS = {
  placed: "order_placed",
  inProduction: "in_production",
  ready: "ready",
  readyForPickup: "ready_for_pickup",
  completed: "completed",
  delivered: "delivered",
  cancelled: "cancelled",
  declined: "declined",
} as const;

export const PAYMENT_STATUS = {
  unpaid: "unpaid",
  paid: "paid",
  refunded: "refunded",
} as const;

export const BOOKING_STATUS = {
  pending: "pending_admin_review",
  assigned: "assigned",
  completed: "completed",
  declined: "declined",
  cancelled: "cancelled",
} as const;

export const normalizeStatus = (status: unknown): string =>
  typeof status === "string"
    ? status.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";

export const isOrderCancelled = (status: unknown): boolean => {
  const value = normalizeStatus(status);
  return value === ORDER_STATUS.cancelled || value === ORDER_STATUS.declined;
};

export const isOrderDelivered = (status: unknown): boolean => {
  const value = normalizeStatus(status);
  return value === ORDER_STATUS.completed || value === ORDER_STATUS.delivered;
};

export const isOrderReady = (status: unknown): boolean => {
  const value = normalizeStatus(status);
  return value === ORDER_STATUS.ready || value === ORDER_STATUS.readyForPickup;
};

export const isOrderWorkActive = (status: unknown): boolean =>
  !isOrderCancelled(status) && !isOrderDelivered(status) && !isOrderReady(status);

export const isCustomerOrderActive = (status: unknown): boolean =>
  !isOrderCancelled(status) && !isOrderDelivered(status);

export const isPaymentPaid = (status: unknown): boolean =>
  normalizeStatus(status) === PAYMENT_STATUS.paid;

export const isBookingPending = (status: unknown): boolean => {
  const value = normalizeStatus(status);
  return value === "pending" || value === BOOKING_STATUS.pending;
};

export const orderStatusLabel = (status: unknown): string => {
  const value = normalizeStatus(status);
  const labels: Record<string, string> = {
    [ORDER_STATUS.placed]: "Order placed",
    active: "In progress",
    [ORDER_STATUS.inProduction]: "In production",
    [ORDER_STATUS.ready]: "Ready",
    [ORDER_STATUS.readyForPickup]: "Ready for pickup",
    [ORDER_STATUS.completed]: "Completed",
    [ORDER_STATUS.delivered]: "Delivered",
    [ORDER_STATUS.cancelled]: "Cancelled",
    [ORDER_STATUS.declined]: "Declined",
  };
  return labels[value] || (value ? value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Unknown");
};

