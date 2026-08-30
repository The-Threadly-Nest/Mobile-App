import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { ProfileAvatarIcon } from "@/shared/components/ProfileAvatarIcon";
import { apiFetch } from "@/shared/utils/apiClient";

// List Icon Components
function MeasurementIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0l12.6 12.6z" />
      <Path d="m14.5 12.5 2-2" />
      <Path d="m11.5 9.5 2-2" />
      <Path d="m8.5 6.5 2-2" />
      <Path d="m17.5 15.5 2-2" />
    </Svg>
  );
}

function OrdersIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3L2.5 7.5V16.5L12 21L21.5 16.5V7.5L12 3Z" />
      <Path d="M12 12L2.5 7.5" />
      <Path d="M12 12V21" />
      <Path d="M12 12L21.5 7.5" />
    </Svg>
  );
}

function FavoritesIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function NotificationsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

function LogOutIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1F1F1F" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 5A7 7 0 1 0 14 19" />
      <Path d="M10 12H21" />
      <Path d="M17 8l4 4-4 4" />
    </Svg>
  );
}

export default function CustomerProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const storedName = useAuthStore((s) => s.name);
  const storedEmail = useAuthStore((s) => s.email);
  const createdAt = useAuthStore((s) => s.createdAt);

  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [avgGiven, setAvgGiven] = useState<string>("0.0");
  const [savedSetsCount, setSavedSetsCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    async function fetchStats() {
      try {
        const orders = await apiFetch<any[]>("/api/orders", { silent: true }).catch(() => []);
        if (mounted && Array.isArray(orders)) {
          setOrdersCount(orders.length);
        }
      } catch {}

      try {
        const prefs = await apiFetch<any>("/api/preferences", { silent: true }).catch(() => null);
        if (mounted && prefs) {
          if (Array.isArray(prefs.favorites)) setFavoritesCount(prefs.favorites.length);
          if (prefs.avgGiven !== undefined) setAvgGiven(Number(prefs.avgGiven).toFixed(1));
        }
      } catch {}
    }

    fetchStats();
    return () => {
      mounted = false;
    };
  }, []);

  const customerName = storedName?.trim()
    ? storedName.trim()
    : storedEmail?.trim()
    ? storedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Christianah James";

  const memberSinceText = React.useMemo(() => {
    if (!createdAt) return "Member since June 2025";
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "Member since June 2025";
    const formatted = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return `Member since ${formatted}`;
  }, [createdAt]);

  return (
    <SafeAreaView className="flex-1 bg-[#FBF7EF]" edges={["top"]}>
      <ScrollView
        className="flex-1 px-4 pt-6"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar & Name Header */}
        <View className="items-center mb-6">
          <View className="mb-3">
            <ProfileAvatarIcon size={64} monogramScale={0.7} />
          </View>
          <Text className="font-display font-semibold text-[24px] text-black">
            {customerName}
          </Text>
          <Text className="font-body text-[14px] text-[#8A7550] mt-0.5">
            {memberSinceText}
          </Text>
        </View>

        {/* 3 Stat Cards Container */}
        <View className="flex-row items-center justify-between gap-2.5 mb-8">
          <View className="flex-1 h-[70px] bg-white rounded-xl items-center justify-center shadow-sm">
            <Text className="font-display font-semibold text-[24px] text-black leading-tight">
              {ordersCount}
            </Text>
            <Text className="font-body text-[14px] text-[#646464] uppercase mt-0.5">
              ORDERS
            </Text>
          </View>

          <View className="flex-1 h-[70px] bg-white rounded-xl items-center justify-center shadow-sm">
            <Text className="font-display font-semibold text-[24px] text-black leading-tight">
              {favoritesCount}
            </Text>
            <Text className="font-body text-[14px] text-[#646464] uppercase mt-0.5">
              FAVORITES
            </Text>
          </View>

          <View className="flex-1 h-[70px] bg-white rounded-xl items-center justify-center shadow-sm">
            <Text className="font-display font-semibold text-[24px] text-black leading-tight">
              {avgGiven}
            </Text>
            <Text className="font-body text-[14px] text-[#646464] uppercase mt-0.5">
              AVG. GIVEN
            </Text>
          </View>
        </View>

        {/* Navigation List Items */}
        <View className="gap-3 px-1">
          {/* Measurement */}
          <Pressable className="flex-row items-center py-2.5 border-b border-dashed border-[#E5E0D5]">
            <View className="w-11 h-11 bg-[#EBE7DF] rounded-xl items-center justify-center mr-3.5">
              <MeasurementIcon />
            </View>
            <View className="flex-1">
              <Text className="font-body text-[14px] text-black">
                Measurement
              </Text>
              <Text className="font-body text-[13px] text-[#8A7550] mt-0.5">
                {savedSetsCount} saved {savedSetsCount === 1 ? "set" : "sets"}
              </Text>
            </View>
          </Pressable>

          {/* My Orders */}
          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/orders")}
            className="flex-row items-center py-2.5 border-b border-dashed border-[#E5E0D5]"
          >
            <View className="w-11 h-11 bg-[#EBE7DF] rounded-xl items-center justify-center mr-3.5">
              <OrdersIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              My Orders
            </Text>
          </Pressable>

          {/* Favorite Houses */}
          <Pressable className="flex-row items-center py-2.5 border-b border-dashed border-[#E5E0D5]">
            <View className="w-11 h-11 bg-[#EBE7DF] rounded-xl items-center justify-center mr-3.5">
              <FavoritesIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Favorite Houses
            </Text>
          </Pressable>

          {/* Notifications */}
          <Pressable className="flex-row items-center py-2.5 border-b border-dashed border-[#E5E0D5]">
            <View className="w-11 h-11 bg-[#EBE7DF] rounded-xl items-center justify-center mr-3.5">
              <NotificationsIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Notifications
            </Text>
          </Pressable>

          {/* Settings */}
          <Pressable className="flex-row items-center py-2.5 border-b border-dashed border-[#E5E0D5]">
            <View className="w-11 h-11 bg-[#EBE7DF] rounded-xl items-center justify-center mr-3.5">
              <SettingsIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Settings
            </Text>
          </Pressable>

          {/* Log Out */}
          <Pressable
            onPress={() => {
              logout();
              router.replace("/(auth)/login");
            }}
            className="flex-row items-center py-2.5"
          >
            <View className="w-11 h-11 bg-[#EBE7DF] rounded-xl items-center justify-center mr-3.5">
              <LogOutIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Log Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


