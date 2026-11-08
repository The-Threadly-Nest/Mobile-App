export type ConnectionStatus = "unknown" | "online" | "offline";
export const OFFLINE_MESSAGE = "You're offline. You can view saved content and manage your cart. Connect to send messages, book or place orders.";
let status: ConnectionStatus = "unknown";
const listeners = new Set<() => void>();
const refreshListeners = new Set<() => void>();
export function deriveConnectionStatus(connected: boolean | null, reachable: boolean | null, previous: ConnectionStatus = "unknown"): ConnectionStatus {
  if (connected === false || reachable === false) return "offline";
  if (connected === true && reachable === true) return "online";
  // Don't flash the banner away while a disconnected device is still reconnecting.
  return previous === "offline" ? "offline" : "unknown";
}
export const getConnectionStatus = () => status;
export function subscribeConnectionStatus(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function updateConnectionStatus(connected: boolean | null, reachable: boolean | null) {
  const next = deriveConnectionStatus(connected, reachable, status);
  if (next === status) return;
  status = next;
  listeners.forEach(listener => listener());
}
export function onConnectionRefresh(listener: () => void) { refreshListeners.add(listener); return () => { refreshListeners.delete(listener); }; }
export function refreshConnectionStatus() { refreshListeners.forEach(listener => listener()); }
