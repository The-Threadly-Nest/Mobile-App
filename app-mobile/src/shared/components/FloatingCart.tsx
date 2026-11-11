import React, { useEffect, useState, useSyncExternalStore } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { router, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShoppingCart } from "lucide-react-native";
import { useCartStore } from "@/stores/useCartStore";
import { Text } from "./Typography";
import { getConnectionStatus, subscribeConnectionStatus } from "../services/connectionStatus";

export default function FloatingCart() {
  const count = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const segments = useSegments() as string[];
  const insets = useSafeAreaInsets();
  const offline = useSyncExternalStore(subscribeConnectionStatus, getConnectionStatus) === "offline";
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (!count || keyboardVisible || segments.some(segment => ["cart", "confirmation", "chat", "direct-chat", "book-measurement"].includes(segment))) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open cart, ${count} ${count === 1 ? "item" : "items"}`}
    onPress={() => router.push("/(customer)/cart")} style={({ pressed }) => [styles.button, { bottom: insets.bottom + (offline ? 176 : 92), opacity: pressed ? 0.8 : 1 }]}>
    <ShoppingCart size={21} color="#453332" strokeWidth={1.7} />
    <View style={styles.badge}><Text style={styles.count}>{count > 99 ? "99+" : count}</Text></View>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { position: "absolute", right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: "#F9E8D3", alignItems: "center", justifyContent: "center", zIndex: 20, elevation: 7, shadowColor: "#2B2B2B", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 7 },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 11, backgroundColor: "#453332", borderWidth: 2, borderColor: "#F9E8D3", alignItems: "center", justifyContent: "center" },
  count: { fontFamily: "InstrumentSans-SemiBold", fontSize: 11, lineHeight: 14, includeFontPadding: false, color: "#FFFFFF" },
});
