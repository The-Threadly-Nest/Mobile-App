import React, { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/shared/components/Typography";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff, X } from "lucide-react-native";
import type { NetInfoState } from "@react-native-community/netinfo";
import { getConnectionStatus, subscribeConnectionStatus, updateConnectionStatus, onConnectionRefresh, refreshConnectionStatus } from "../services/connectionStatus";

/** One floating offline notice; cached screens keep their normal safe-area layout. */
export default function ConnectionFrame({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus, () => "unknown" as const);
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const offline = status === "offline";
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (!offline) setDismissed(false); }, [offline]);
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
    <View style={styles.frame}>{children}</View>
    {offline && !dismissed ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.banner, { bottom: insets.bottom + 100 }]}>
      <WifiOff size={20} color="#FFFFFF" />
      <View style={styles.copy}><Text style={styles.title}>You're offline</Text><Text style={styles.body}>Showing saved content</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Check internet connection" disabled={checking} onPress={refreshConnectionStatus} style={styles.retry}><Text style={styles.retryText}>{checking ? "Checking…" : "Retry"}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss offline notice" onPress={() => setDismissed(true)} style={styles.dismiss}><X size={18} color="#FFFFFF" /></Pressable>
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  frame: { flex: 1 }, banner: { position: "absolute", left: 16, right: 16, zIndex: 100, elevation: 12, borderRadius: 18, backgroundColor: "#2B2B2B", paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#2B2B2B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8 },
  copy: { flex: 1 }, title: { fontFamily: "InstrumentSans-SemiBold", color: "#FFFFFF", fontSize: 13 },
  body: { fontFamily: "InstrumentSans-Regular", color: "#FFFFFF", fontSize: 12, lineHeight: 17, marginTop: 2 },
  retry: { minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }, retryText: { fontFamily: "InstrumentSans-SemiBold", color: "#FFFFFF", fontSize: 12 },
  dismiss: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
});
