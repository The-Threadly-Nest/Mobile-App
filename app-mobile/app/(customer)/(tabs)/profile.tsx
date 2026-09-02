import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, Pressable, TextInput, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { MapPin, Phone, Edit2, Check, Navigation } from "lucide-react-native";
import * as Location from "expo-location";
import { useAuthStore } from "@/stores/useAuthStore";
import { ProfileAvatarIcon } from "@/shared/components/ProfileAvatarIcon";
import { apiFetch } from "@/shared/utils/apiClient";
import { PhoneInputWithCountry } from "@/shared/components/PhoneInputWithCountry";

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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const logout = useAuthStore((s) => s.logout);
  const storedName = useAuthStore((s) => s.name);
  const storedEmail = useAuthStore((s) => s.email);
  const storedPhone = useAuthStore((s) => s.phone);
  const storedLocation = useAuthStore((s) => s.location);
  const setPhone = useAuthStore((s) => s.setPhone);
  const setLocation = useAuthStore((s) => s.setLocation);
  const createdAt = useAuthStore((s) => s.createdAt);

  const [ordersCount, setOrdersCount] = useState<number>(0);
  const [favoritesCount, setFavoritesCount] = useState<number>(0);
  const [avgGiven, setAvgGiven] = useState<string>("0.0");
  const [savedSetsCount, setSavedSetsCount] = useState<number>(0);

  // Edit Personal Info state
  const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);
  const [tempPhone, setTempPhone] = useState<string>(storedPhone || "");
  const [tempLocation, setTempLocation] = useState<string>(storedLocation || "Lagos, Nigeria");
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  useEffect(() => {
    setTempPhone(storedPhone || "");
    setTempLocation(storedLocation || "Lagos, Nigeria");
  }, [storedPhone, storedLocation]);

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
          if (prefs.phone) setPhone(prefs.phone);
          if (prefs.location) setLocation(prefs.location);
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

  const handleSaveContactInfo = async () => {
    const newPhone = tempPhone.trim();
    const newLocation = tempLocation.trim() || "Lagos, Nigeria";

    setPhone(newPhone);
    setLocation(newLocation);
    setIsEditingInfo(false);

    try {
      await apiFetch("/api/preferences", {
        method: "POST",
        body: JSON.stringify({ phone: newPhone, location: newLocation }),
        silent: true,
      });
    } catch (e) {
      console.log("Could not sync preferences to server:", e);
    }
  };

  const handleAutoDetectLocation = async () => {
    try {
      setIsDetecting(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setIsDetecting(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const city = place.city || place.subregion || place.region || "Lagos";
        const country = place.country || "Nigeria";
        const formatted = `${city}, ${country}`;
        setTempLocation(formatted);
        setLocation(formatted);

        apiFetch("/api/preferences", {
          method: "POST",
          body: JSON.stringify({ location: formatted }),
          silent: true,
        }).catch(() => {});
      }
    } catch (e) {
      console.log("Profile auto detect error:", e);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FBF7EF]" edges={["top"]}>
      <ScrollView
        className="flex-1 px-4 pt-6"
        contentContainerStyle={[
          { paddingBottom: 64 },
          isLandscape && { maxWidth: 840, alignSelf: "center", width: "100%", paddingHorizontal: 16 },
        ]}
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
        <View className="flex-row items-center justify-between gap-2.5 mb-6">
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

        {/* Contact & Location Details Card */}
        <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm border border-[#F0EBE1]">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-body font-semibold text-[15px] text-[#4A080C]">
              Personal Information
            </Text>
            {!isEditingInfo ? (
              <Pressable
                onPress={() => setIsEditingInfo(true)}
                className="flex-row items-center bg-[#F7F4EC] px-3 py-1.5 rounded-full"
              >
                <Edit2 size={13} color="#4A080C" style={{ marginRight: 4 }} />
                <Text className="font-body text-[12px] text-[#4A080C] font-medium">Edit</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSaveContactInfo}
                className="flex-row items-center bg-[#4A080C] px-3.5 py-1.5 rounded-full"
              >
                <Check size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text className="font-body text-[12px] text-white font-medium">Save</Text>
              </Pressable>
            )}
          </View>

          {!isEditingInfo ? (
            <View className="gap-2.5">
              {/* Phone Display */}
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-[#FBF7EF] items-center justify-center mr-3">
                  <Phone size={15} color="#3A2E1A" />
                </View>
                <View className="flex-1">
                  <Text className="font-body text-[11px] text-[#8A7550] uppercase tracking-wide">Phone Number</Text>
                  <Text className="font-body text-[14px] text-black">
                    {storedPhone || "Add phone number"}
                  </Text>
                </View>
              </View>

              <View className="h-[1px] bg-[#F5F1E8]" />

              {/* Location Display */}
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-[#FBF7EF] items-center justify-center mr-3">
                  <MapPin size={15} color="#3A2E1A" />
                </View>
                <View className="flex-1">
                  <Text className="font-body text-[11px] text-[#8A7550] uppercase tracking-wide">Location</Text>
                  <Text className="font-body text-[14px] text-black">
                    {storedLocation || "Lagos, Nigeria"}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="gap-3 pt-1">
              {/* Phone Input */}
              <PhoneInputWithCountry
                label="Phone Number"
                placeholder="801 234 5678"
                value={tempPhone}
                onChangePhone={setTempPhone}
              />

              {/* Location Input & Auto Detect */}
              <View>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="font-body text-[12px] text-[#8A7550]">Location</Text>
                  <Pressable
                    onPress={handleAutoDetectLocation}
                    className="flex-row items-center"
                  >
                    <Navigation size={12} color="#4A080C" style={{ marginRight: 3 }} />
                    <Text className="font-body text-[11px] text-[#4A080C] font-semibold">
                      {isDetecting ? "Detecting..." : "Auto-detect"}
                    </Text>
                    {isDetecting && <ActivityIndicator size="small" color="#4A080C" style={{ marginLeft: 4 }} />}
                  </Pressable>
                </View>
                <TextInput
                  value={tempLocation}
                  onChangeText={setTempLocation}
                  placeholder="e.g. Lagos, Nigeria"
                  className="bg-[#FBF7EF] border border-[#E5E0D5] rounded-xl px-3.5 py-2.5 text-[14px] text-black font-body"
                />
              </View>
            </View>
          )}
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



