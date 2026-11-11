import { isOrderCancelled, isOrderDelivered, isOrderWorkActive, normalizeStatus } from "../domain/statuses";
import { isReadyToWear } from "./orderFulfillment";

export function isUnassignedOrder(order: any): boolean {
  if (!order || typeof order !== "object") return false;
  if (isReadyToWear(order)) return ["order_placed", "booked", "pending", "pending_admin_review"].includes(String(order.status || "order_placed").toLowerCase());
  return !order.staffId && !order.staff?.id && !isOrderCancelled(order.status) && !isOrderDelivered(order.status);
}

export function isRunningOrder(order: any): boolean {
  if (!order || typeof order !== "object") return false;
  return (Boolean(order.staffId || order.staff?.id) || (isReadyToWear(order) && !isUnassignedOrder(order))) && isOrderWorkActive(order.status);
}

export function isAcceptedOrder(order: any): boolean {
  if (!order || typeof order !== "object" || normalizeStatus(order.status) === "declined") return false;
  return Boolean(order.staffId || order.staff?.id) || ["assigned", "active", "measurements_confirmed", "fabric_sourced", "in_production", "quality_check", "ready", "ready_for_pickup", "completed", "delivered"].includes(normalizeStatus(order.status));
}

/** Use record IDs, not customer names: one customer can place several orders. */
export function adminOrderRequests(orders: any[], bookings: any[]) {
  const coveredBookings = new Set(orders.map(order => order.bookingId).filter(Boolean));
  const requests = orders.filter(isUnassignedOrder).map(order => ({
    ...order, orderId: order.id, customerName: order.customer?.name || "Customer",
    reason: order.itemName || "Order request", resolved: false, bookingStatus: "pending",
  }));
  for (const booking of bookings) {
    // ChatEscalation rows are support messages, not saved appointment bookings.
    if (!booking.preferredDate && !booking.bookingStatus && !booking.purpose) continue;
    if (coveredBookings.has(booking.id) || booking.resolved || ["assigned", "completed", "delivered", "cancelled", "declined"].includes(booking.bookingStatus || booking.status)) continue;
    requests.push(booking);
  }
  return [...new Map(requests.map(request => [request.orderId ? `order:${request.id}` : `booking:${request.id}`, request])).values()]
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
