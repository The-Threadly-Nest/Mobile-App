import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { usePathname } from "expo-router";
import { Text } from "./Typography";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "../utils/apiClient";
import { sqliteStateStorage } from "../services/sqliteStateStorage";

const Context = createContext({ messages: 0, requests: 0 });
export const useActivityBadges = () => useContext(Context);
export function ActivityBadge({ count }: { count: number }) {
  if (!count) return null;
  return <View accessibilityLabel={`${count} new notifications`} style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, marginHorizontal: 6, backgroundColor: "#453332", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontFamily: "InstrumentSans-SemiBold", fontSize: 12 }}>{count > 99 ? "99+" : count}</Text></View>;
}
export function ActivityBadgesProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token), role = useAuthStore(s => s.role), email = useAuthStore(s => s.email);
  const pathname = usePathname();
  const [counts, setCounts] = useState({ messages: 0, requests: 0 });
  useEffect(() => {
    let active = true, busy = false;
    setCounts({ messages: 0, requests: 0 });
    if (!token || !email || !["admin", "customer", "staff"].includes(role || "")) return;
    const key = `activity-seen:${role}:${email.toLowerCase()}`;
    const refresh = async () => {
      if (busy || AppState.currentState !== "active") return;
      busy = true;
      try {
        let rows: any[];
        if (role === "staff") {
          const me = await apiFetch<{ id: string }>("/api/staff/me", { silent: true });
          const session = await apiFetch<{ history?: any[] }>(`/api/chat/session/${me.id}`, { silent: true });
          const history = session.history || [];
          let unreadCount = 0;
          for (let i = history.length - 1; i >= 0 && ["admin", "model"].includes(history[i].role); i--) unreadCount++;
          rows = [{ id: me.id, unreadCount, latestMessage: history[history.length - 1] }];
        } else rows = await apiFetch<any[]>(role === "admin" ? "/api/direct-messages/threads" : "/api/direct-messages/my-threads", { silent: true });
        if (!active || useAuthStore.getState().token !== token) return;
        const signature = JSON.stringify(rows.filter(r => r.unreadCount > 0).map(r => [r.customerId || r.fashionHouseId || r.id, r.unreadCount, r.latestMessage, r.updatedAt]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
        const seen = await sqliteStateStorage.getItem(key);
        const viewing = pathname.includes("messages") || pathname.includes("direct-chat") || (role === "staff" && pathname.endsWith("/chat"));
        if (!active) return;
        if (viewing) await sqliteStateStorage.setItem(key, signature);
        if (active) setCounts(previous => ({ ...previous, messages: viewing || seen === signature ? 0 : rows.reduce((n,r) => n + Math.max(0, r.unreadCount || 0), 0) }));
        if (role === "admin") {
          const requests = await apiFetch<any[]>("/api/escalations", { silent: true, cache: "reload" });
          if (!active || !Array.isArray(requests)) return;
          const pending = requests.filter(r => !r.resolved && ["pending", "pending_admin_review", "order_placed"].includes(r.status));
          const signature = JSON.stringify(pending.map(r => [r.id, r.status]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
          const requestKey = `${key}:requests`;
          const seen = await sqliteStateStorage.getItem(requestKey);
          const viewing = pathname.includes("escalations");
          if (!active) return;
          if (viewing) await sqliteStateStorage.setItem(requestKey, signature);
          if (active) setCounts(previous => ({ ...previous, requests: viewing || seen === signature ? 0 : pending.length }));
        }
      } catch { /* Keep the last known indicator during connection failures. */ }
      finally { busy = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    const app = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => { active = false; clearInterval(timer); app.remove(); };
  }, [token, role, email, pathname]);
  return <Context.Provider value={counts}>{children}</Context.Provider>;
}
