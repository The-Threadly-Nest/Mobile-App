import React, { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import type { NetInfoState } from "@react-native-community/netinfo";
import { getConnectionStatus, subscribeConnectionStatus, updateConnectionStatus, onConnectionRefresh, refreshConnectionStatus } from "../services/connectionStatus";

/** Mounted once: cached screens remain interactive; the banner never covers their controls. */
export default function ConnectionFrame({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus, () => "unknown" as const);
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const offline = status === "offline";
  useEffect(() => {
    let active = true, revision = 0;
    let removeNetwork: (() => void) | undefined;
    let removeRefresh: (() => void) | undefined;
    let appState: ReturnType<typeof AppState.addEventListener> | undefined;
    try {
      // Older development clients should not crash before the new native build is installed.
      const NetInfo = (require("@react-native-community/netinfo") as typeof import("@react-native-community/netinfo")).default;
      const apply = (state: NetInfoState) => { if (active) updateConnectionStatus(state.isConnected, state.isInternetReachable); };
      const refresh = async () => {
        const version = ++revision;
        if (active) setChecking(true);
        try { const state = await NetInfo.refresh(); if (version === revision) apply(state); }
        catch { /* An unavailable monitor isn't proof of being offline. */ }
        finally { if (active) setChecking(false); }
      };
      removeNetwork = NetInfo.addEventListener(state => { revision++; apply(state); });
      removeRefresh = onConnectionRefresh(() => { void refresh(); });
      appState = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
      void refresh();
    } catch {
      console.warn("Connection monitoring requires the latest native app build.");
    }
    return () => { active = false; removeNetwork?.(); removeRefresh?.(); appState?.remove(); };
  }, []);

  return <View style={styles.frame}>
    {offline ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.banner, { paddingTop: insets.top + 10 }]}>
      <WifiOff size={18} color="#453332" style={{ marginTop: 2 }} />
      <View style={styles.copy}><Text style={styles.title}>You're offline</Text><Text style={styles.body}>View saved content or manage your cart. Connect to send messages, book or place orders.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Check internet connection" disabled={checking} onPress={refreshConnectionStatus} style={styles.retry}><Text style={styles.retryText}>{checking ? "Checking…" : "Retry"}</Text></Pressable>
    </View> : null}
    <SafeAreaInsetsContext.Provider value={offline ? { ...insets, top: 0 } : insets}>
      <View style={styles.frame}>{children}</View>
    </SafeAreaInsetsContext.Provider>
  </View>;
}
const styles = StyleSheet.create({
  frame: { flex: 1 }, banner: { backgroundColor: "#EFECE6", paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  copy: { flex: 1 }, title: { fontFamily: "InstrumentSans-SemiBold", color: "#000000", fontSize: 13 },
  body: { fontFamily: "InstrumentSans-Regular", color: "#000000", fontSize: 12, lineHeight: 17, marginTop: 2 },
  retry: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }, retryText: { fontFamily: "InstrumentSans-SemiBold", color: "#000000", fontSize: 12 },
});
