import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { router } from "expo-router";
import { Text } from "@/shared/components/Typography";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import { apiFetch } from "@/shared/utils/apiClient";

type MessageThread = {
  customerId: string;
  customerName: string;
  latestMessage?: string;
  latestAt?: string | null;
  unreadCount: number;
};

export default function AdminNotificationsScreen() {
  const [tab, setTab] = useState<"notifications" | "messages">("notifications");
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab !== "messages") return;
    let active = true;
    setLoading(true);
    apiFetch<MessageThread[]>("/api/direct-messages/threads", { silent: true })
      .then((data) => {
        if (active && Array.isArray(data)) setThreads(data);
      })
      .catch(() => {
        if (active) setThreads([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={4}
          style={styles.back}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(admin)/dashboard")}
        >
          <BackArrowIcon />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "notifications" }} style={styles.tab} onPress={() => setTab("notifications")}>
          <Text style={[styles.tabText, tab === "notifications" && styles.activeText]}>Notifications</Text>
          {tab === "notifications" ? <View style={styles.activeLine} /> : null}
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "messages" }}
          style={styles.tab}
          onPress={() => setTab("messages")}
        >
          <Text style={[styles.tabText, tab === "messages" && styles.activeText]}>Messages</Text>
          {tab === "messages" ? <View style={styles.activeLine} /> : null}
        </Pressable>
      </View>

      {tab === "notifications" ? (
        <View style={styles.empty}>
          <Bell size={32} color="#2B2B2B" strokeWidth={2} />
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptyText}>Unread conversation alerts appear here.</Text>
        </View>
      ) : loading ? (
        <View style={styles.empty}><ActivityIndicator color="#453332" /></View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.customerId}
          contentContainerStyle={[styles.messageList, threads.length === 0 && styles.emptyList]}
          renderItem={({ item }) => (
            <View style={styles.messageRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.customerName?.charAt(0).toUpperCase() || "C"}</Text>
              </View>
              <View style={styles.messageContent}>
                <Text style={styles.messageName}>{item.customerName || "Customer"}</Text>
                <Text style={styles.messagePreview} numberOfLines={1}>{item.latestMessage || "No messages yet"}</Text>
              </View>
              {item.unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount}</Text></View> : null}
            </View>
          )}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No messages yet</Text><Text style={styles.emptyText}>Messages from customers appear here.</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 22, paddingTop: SCREEN_TOP_SPACING, paddingBottom: 12 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "InstrumentSans-Regular", fontSize: 18, color: "#4A403B" },
  tabs: { flexDirection: "row", height: 48, marginHorizontal: 48, marginTop: -12, marginBottom: 8 },
  tab: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 8, position: "relative" },
  tabText: { fontFamily: "InstrumentSans-Regular", fontSize: 14, color: "#4A403B" },
  activeText: { color: "#F96951" },
  activeLine: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2, backgroundColor: "#453332" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingBottom: 80, gap: 12 },
  emptyTitle: { fontFamily: "InstrumentSans-Medium", fontSize: 24, color: "#453332" },
  emptyText: { fontFamily: "InstrumentSans-Regular", fontSize: 16, color: "#453332", textAlign: "center" },
  messageList: { paddingHorizontal: 24, paddingBottom: 24 },
  emptyList: { flexGrow: 1 },
  messageRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 15 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E4D5B7", alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "InstrumentSans-Medium", fontSize: 12, color: "#453332" },
  messageContent: { flex: 1, gap: 5 },
  messageName: { fontFamily: "InstrumentSans-Regular", fontSize: 16, color: "#4A403B" },
  messagePreview: { fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#4A403B" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: "InstrumentSans-Regular", fontSize: 10, color: "#FFFFFF" },
});
