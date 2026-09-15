import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { MessageSquare } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { apiFetch } from "@/shared/utils/apiClient";

interface ChatThread {
  fashionHouseId: string;
  fashionHouseName: string;
  fashionHouseLogo: string | null;
  latestMessage: string;
  latestAt: string | null;
  unreadCount: number;
}

function formatThreadTime(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function CustomerMessagesScreen() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchThreads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await apiFetch<ChatThread[]>("/api/direct-messages/my-threads", {
        silent: true,
      }).catch(() => []);
      if (Array.isArray(data)) {
        setThreads(data);
      }
    } catch {
      // silent catch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads])
  );

  const renderThreadItem = ({ item }: { item: ChatThread }) => {
    const initials = item.fashionHouseName
      ? item.fashionHouseName
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : "FH";

    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: `/(customer)/direct-chat/${item.fashionHouseId}`,
            params: { fashionHouseName: item.fashionHouseName },
          })
        }
        className="flex-row items-center px-4 py-3.5 border-b border-[#F5F1E8] bg-white active:bg-[#F7F4EC]"
      >
        {/* Avatar / Logo */}
        <View className="w-12 h-12 rounded-full bg-[#EBE7DF] items-center justify-center mr-3 overflow-hidden border border-[#E5E0D5]">
          {item.fashionHouseLogo ? (
            <Image
              source={{ uri: item.fashionHouseLogo }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <Text className="font-display font-semibold text-[15px] text-[#4A080C]">
              {initials}
            </Text>
          )}
        </View>

        {/* Content */}
        <View className="flex-1 mr-2">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="font-display font-semibold text-[15px] text-black flex-1 mr-2"
              numberOfLines={1}
            >
              {item.fashionHouseName}
            </Text>
            <Text className="font-body text-[12px] text-[#8A7550]">
              {formatThreadTime(item.latestAt)}
            </Text>
          </View>
          <Text
            className={`font-body text-[13px] ${
              item.unreadCount > 0 ? "font-semibold text-black" : "text-[#646464]"
            }`}
            numberOfLines={1}
          >
            {item.latestMessage || "No messages yet"}
          </Text>
        </View>

        {/* Unread Badge */}
        {item.unreadCount > 0 && (
          <View className="bg-[#4A080C] min-w-[20px] h-5 rounded-full px-1.5 items-center justify-center">
            <Text className="font-body font-bold text-[11px] text-white">
              {item.unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FBF7EF]" edges={["top"]}>
      {/* Header */}
      <View style={{ paddingTop: 36 }} className="flex-row items-center px-4 pb-3 bg-[#FBF7EF] border-b border-[#F0EBE1]">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 rounded-full active:bg-[#EFECE6]"
        >
          <BackArrowIcon color="#3A2E1A" size={24} />
        </Pressable>
        <Text className="font-display font-semibold text-[20px] text-black ml-1 flex-1">
          My Messages
        </Text>
      </View>

      {/* List / Loading / Empty */}
      {loading && !refreshing ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color="#4A080C" />
          <Text className="font-body text-[14px] text-[#8A7550] mt-3">
            Loading conversations...
          </Text>
        </View>
      ) : threads.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6 py-12">
          <View className="w-16 h-16 rounded-full bg-[#EBE7DF] items-center justify-center mb-4">
            <MessageSquare size={28} color="#4A080C" />
          </View>
          <Text className="font-display font-semibold text-[18px] text-black text-center mb-1">
            No Messages Yet
          </Text>
          <Text className="font-body text-[14px] text-[#8A7550] text-center leading-relaxed max-w-[280px]">
            When you contact fashion houses for bespoke inquiries or fittings, your chats will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.fashionHouseId}
          renderItem={renderThreadItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchThreads(true)}
              tintColor="#4A080C"
              colors={["#4A080C"]}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}
