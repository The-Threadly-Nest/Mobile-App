import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "../utils/apiClient";
import { getConnectionStatus, subscribeConnectionStatus } from "../services/connectionStatus";
import { retryAccountCleanup } from "../services/accountCleanup";

export default function SessionMonitor() {
  const token = useAuthStore(state => state.token);
  useEffect(() => {
    void retryAccountCleanup().catch(() => {});
    if (!token) return;
    let busy = false;
    let active = true;
    const check = async () => {
      if (!active || busy || AppState.currentState !== "active" || getConnectionStatus() === "offline" || useAuthStore.getState().token !== token) return;
      busy = true;
      try { await apiFetch("/api/auth/session", { cache: "no-store", silent: true, retryCount: 3 }); }
      catch { /* Only apiFetch's authenticated 401 handler clears the account. */ }
      finally { busy = false; }
    };
    void check();
    const app = AppState.addEventListener("change", state => { if (state === "active") void check(); });
    const connection = subscribeConnectionStatus(() => { if (getConnectionStatus() === "online") void check(); });
    const timer = setInterval(() => void check(), 60000);
    return () => { active = false; clearInterval(timer); app.remove(); connection(); };
  }, [token]);
  return null;
}
