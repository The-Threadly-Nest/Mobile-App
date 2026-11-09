import { apiFetch } from "../utils/apiClient";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";

export async function preloadStartupData() {
  const session = useAuthStore.getState();
  if (!session.token || !session.role) return;
  if (!useAppDataStore.persist.hasHydrated()) await useAppDataStore.persist.rehydrate();
  const store = useAppDataStore.getState();
  store.activateCache(`${session.role}:${session.email.trim().toLowerCase()}`);
  const options = { silent: true, timeoutMs: 8000, retryCount: 3 };
  const current = () => useAuthStore.getState().token === session.token;
  const read = async (url: string, save?: (value: any) => void) => {
    try { const value = await apiFetch<any>(url, options); if (current()) save?.(value); }
    catch { /* Keep saved content and allow the screen's normal retry/offline UI. */ }
  };
  if (session.role === "admin") {
    await Promise.all([
      read("/api/admin/profile", value => store.setProfile(value.fashionHouse || value)),
      read("/api/admin/dashboard-summary", store.setDashboardSummary),
      read("/api/orders", store.setOrders), read("/api/escalations", store.setEscalations),
      read("/api/staff", store.setStaffList), read("/api/catalog?page=1&limit=10"),
    ]);
  } else if (session.role === "staff") {
    await Promise.all([read("/api/orders", store.setOrders), read("/api/staff/me", store.setProfile)]);
  } else {
    await Promise.all([read("/api/orders/my-orders", store.setOrders), read("/api/catalog/marketplace?page=1&limit=50"), read("/api/fashion-houses?limit=20")]);
  }
}
