import React, { useState, useCallback, useRef } from "react";
import { View, FlatList, Pressable, ActivityIndicator, RefreshControl, Image, StyleSheet, AppState } from "react-native";
import { Text } from "@/shared/components/Typography";
import { Image as AssetImage } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { MessageSquare, Bell } from "lucide-react-native";
import { apiFetch } from "@/shared/utils/apiClient";
import { useAuthStore } from "@/stores/useAuthStore";
import { createPageCacheOwner, readPageCache, writePageCache } from "@/shared/services/pageCache";
import { formatChatDate } from "@/shared/utils/formatters";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { type MessageThread, unreadMessages, visibleMessageThreads } from "@/shared/utils/messageThreads";

const assets = {
  badge: require("../../../assets/messages/unread.svg"),
  divider: require("../../../assets/messages/tab-line.svg"),
  active: require("../../../assets/messages/active-line.svg"),
};

function formatThreadTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  return date.toDateString() === yesterday.toDateString() ? "Yesterday" : formatChatDate(date);
}

export default function CustomerMessagesScreen() {
  const role = useAuthStore(state => state.role);
  const email = useAuthStore(state => state.email);
  const cacheOwner = createPageCacheOwner(role, email);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [tab, setTab] = useState<"messages" | "notifications">("messages");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const owner = useRef(cacheOwner);
  const hasLoaded = useRef(false);
  const request = useRef(0);
  const focused = useRef(false);

  const fetchThreads = useCallback(async (refresh = false) => {
    const version = ++request.current;
    const active = () => focused.current && version === request.current;
    if (refresh) setRefreshing(true);
    else if (!hasLoaded.current) setLoading(true);
    try {
      if (!refresh && !hasLoaded.current) {
        const cached = await readPageCache<MessageThread[]>(cacheOwner, "customer-message-threads");
        if (!active()) return;
        if (Array.isArray(cached)) { setThreads(cached); setLoading(false); }
      }
      const data = await apiFetch<MessageThread[]>("/api/direct-messages/my-threads", { silent: true });
      if (!active()) return;
      if (!Array.isArray(data)) throw new Error("Invalid conversations response");
      setThreads(data); setError("");
      void writePageCache(cacheOwner, "customer-message-threads", data);
    } catch {
      if (active()) setError("We couldn't refresh your messages. Please try again.");
    } finally {
      if (active()) { hasLoaded.current = true; setLoading(false); setRefreshing(false); }
    }
  }, [cacheOwner]);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    if (owner.current !== cacheOwner) {
      owner.current = cacheOwner; hasLoaded.current = false; setThreads([]); setError("");
    }
    void fetchThreads();
    const timer = setInterval(() => { if (AppState.currentState === "active") void fetchThreads(); }, 30000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void fetchThreads(); });
    return () => { focused.current = false; request.current++; clearInterval(timer); subscription.remove(); };
  }, [cacheOwner, fetchThreads]));

  const unread = unreadMessages(threads);
  const visible = visibleMessageThreads(threads, tab);

  const renderThread = ({ item }: { item: MessageThread }) => {
    const initials = item.fashionHouseName?.trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "FH";
    const isUnread = item.unreadCount > 0;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.fashionHouseName}${isUnread ? `, ${item.unreadCount} unread messages` : ""}`}
        onPress={() => router.push({ pathname: `/(customer)/direct-chat/${item.fashionHouseId}`, params: {
          fashionHouseName: item.fashionHouseName, fashionHouseLogo: item.fashionHouseLogo || undefined,
        } })} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.avatar}>
          {item.fashionHouseLogo ? <Image source={{ uri: item.fashionHouseLogo }} style={styles.avatarImage} resizeMode="cover" />
            : <Text style={styles.initials}>{initials}</Text>}
        </View>
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>{item.fashionHouseName}</Text>
          <Text style={[styles.preview, isUnread && styles.unreadPreview]} numberOfLines={1}>{item.latestMessage || "Start a conversation"}</Text>
        </View>
        <View style={styles.trailing}>
          <Text style={[styles.time, isUnread && styles.unreadPreview]} numberOfLines={1}>{formatThreadTime(item.latestAt)}</Text>
          {isUnread ? <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
          </View> : <View style={styles.badgeSpacer} />}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={4} style={styles.back}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/browse")}>
          <BackArrowIcon />
        </Pressable>
        <Text style={styles.title}>Messages</Text>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        <AssetImage source={assets.divider} style={styles.tabDivider} contentFit="fill" />
        {(["notifications", "messages"] as const).map(value => <Pressable key={value} accessibilityRole="tab"
          accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={styles.tab}>
          <Text style={[styles.tabText, tab === value && styles.activeText]}>{value === "messages" ? `Messages${unread ? ` (${unread})` : ""}` : "Notifications"}</Text>
          {tab === value && <AssetImage source={assets.active} style={styles.activeLine} contentFit="contain" />}
        </Pressable>)}
      </View>
      {error ? <View style={styles.error} accessibilityLiveRegion="polite">
        <Text style={styles.errorText}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void fetchThreads(true); }} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View> : null}
      <FlatList data={visible} keyExtractor={item => item.fashionHouseId} renderItem={renderThread}
        contentContainerStyle={[styles.list, !visible.length && styles.emptyList]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void fetchThreads(true); }} tintColor="#453332" />}
        ListEmptyComponent={loading ? <ActivityIndicator color="#453332" accessibilityLabel="Loading conversations" /> : !error ? <View style={styles.empty}>
          {tab === "notifications" ? <Bell size={28} color="#2B2B2B" /> : <MessageSquare size={28} color="#2B2B2B" />}
          <Text style={styles.emptyTitle}>{tab === "notifications" ? "You're all caught up" : "No messages yet"}</Text>
          <Text style={styles.emptyText}>{tab === "notifications" ? "Unread conversation alerts appear here." : "Your conversations with fashion houses will appear here."}</Text>
        </View> : null} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F9E8D3" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 22, paddingTop: SCREEN_TOP_SPACING, paddingBottom: 12 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backAsset: { width: 39.7906, height: 39.7907 },
  title: { fontFamily: "InstrumentSans-Regular", fontSize: 17, color: "#4A403B" },
  tabs: { flexDirection: "row", height: 48, marginBottom: 12 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 2 },
  tabText: { fontFamily: "InstrumentSans-Regular", fontSize: 14, color: "#4A403B" },
  activeText: { fontFamily: "InstrumentSans-SemiBold", color: "#F96951" },
  tabDivider: { display: "none", position: "absolute", bottom: 0, alignSelf: "center", width: 332.473, height: 0.884236 },
  activeLine: { position: "absolute", bottom: 0, width: 129.099, height: 1.76847 },
  list: { paddingHorizontal: 24, paddingBottom: 28 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 78, gap: 14, paddingVertical: 15 },
  pressed: { opacity: 0.65 },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#F9E8D3" },
  avatarImage: { width: 32, height: 32 },
  initials: { fontFamily: "InstrumentSans-Medium", fontSize: 12, color: "#453332" },
  content: { flex: 1, minWidth: 0, gap: 5 },
  name: { fontFamily: "InstrumentSans-Regular", fontSize: 16, letterSpacing: 0.3, color: "#4A403B" },
  preview: { fontFamily: "InstrumentSans-Regular", fontSize: 12, letterSpacing: 0.25, color: "#4A403B" },
  unreadPreview: { color: "#4A403B" },
  trailing: { alignItems: "flex-end", gap: 6, maxWidth: 64 },
  time: { fontFamily: "InstrumentSans-Regular", fontSize: 10, color: "#4A403B" },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
  badgeAsset: { position: "absolute", width: 19.4532, height: 19.4532 },
  badgeText: { fontFamily: "InstrumentSans-Regular", fontSize: 10, color: "#4A403B" },
  badgeSpacer: { height: 19.4532 },
  separator: { display: "none", height: 1, backgroundColor: "#FFFFFF" },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 12, paddingHorizontal: 24, paddingBottom: 80 },
  emptyTitle: { fontFamily: "InstrumentSans-Medium", fontSize: 18, color: "#4A403B" },
  emptyText: { fontFamily: "InstrumentSans-Regular", fontSize: 14, lineHeight: 21, textAlign: "center", color: "#4A403B" },
  error: { paddingHorizontal: 24, paddingVertical: 12, gap: 6 },
  errorText: { fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#F96951" },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingRight: 16 },
  retryText: { fontFamily: "InstrumentSans-SemiBold", fontSize: 14, color: "#453332" },
});
