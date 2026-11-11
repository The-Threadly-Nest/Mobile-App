export function isReadyOrder(items: unknown): boolean {
  return Array.isArray(items) && items.length > 0 && items.every(item =>
    item && typeof item === "object" && !Array.isArray(item) && typeof item.selectedSize === "string" && item.selectedSize.trim().length > 0);
}

export function readyOrderProgress(status: string): number {
  if (["cancelled", "declined"].includes(status)) return 0;
  if (["completed", "delivered"].includes(status)) return 100;
  if (["ready", "ready_for_pickup"].includes(status)) return 75;
  if (["in_production", "fabric_sourced", "quality_check", "assigned", "active"].includes(status)) return 50;
  return 25;
}

export function readyOrderLabel(status: string): string {
  if (status === "cancelled") return "Order cancelled";
  if (status === "declined") return "Order declined";
  if (["completed", "delivered"].includes(status)) return "Order completed";
  if (["ready", "ready_for_pickup"].includes(status)) return "Ready for pickup";
  if (readyOrderProgress(status) === 50) return "Preparing your order";
  return "Awaiting fashion house confirmation";
}
