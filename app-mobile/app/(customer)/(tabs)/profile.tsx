import React, { useState, useEffect, useCallback } from "react";
import { formatMonthYear } from "@/shared/utils/formatters";
import { View, ScrollView, Pressable, ActivityIndicator, useWindowDimensions, Modal, Linking, Image } from "react-native";
import { Text, TextInput } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { MapPin, Phone, Edit2, Check, Navigation, X, Ruler, ChevronRight, LogOut, User } from "lucide-react-native";
import * as Location from "expo-location";
import { useAuthStore } from "@/stores/useAuthStore";
import { useOrdersStore } from "@/stores/useOrdersStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { ProfileAvatarIcon } from "@/shared/components/ProfileAvatarIcon";
import { apiFetch } from "@/shared/utils/apiClient";
import { PhoneInputWithCountry } from "@/shared/components/PhoneInputWithCountry";
import { ProfileDesignHeader, ProfileDesignIcon, ProfileMenuGroups } from "@/shared/components/ProfileDesign";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { ProfileSettingsPopup } from "@/shared/components/ProfileSettingsPopup";
import { KeyboardAwareScrollView } from "@/shared/components/KeyboardAwareScrollView";
import CustomerMeasurementsModal from "@/shared/components/CustomerMeasurementsModal";
import { measurementGroups } from "@/shared/utils/customerMeasurements";

// List Icon Components
function MeasurementIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0l12.6 12.6z" />
      <Path d="m14.5 12.5 2-2" />
      <Path d="m11.5 9.5 2-2" />
      <Path d="m8.5 6.5 2-2" />
      <Path d="m17.5 15.5 2-2" />
    </Svg>
  );
}

function MessagesIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

function OrdersIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3L2.5 7.5V16.5L12 21L21.5 16.5V7.5L12 3Z" />
      <Path d="M12 12L2.5 7.5" />
      <Path d="M12 12V21" />
      <Path d="M12 12L21.5 7.5" />
    </Svg>
  );
}

function FavoritesIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.72-8.72 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </Svg>
  );
}

function NotificationsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

function LogOutIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#F96951" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 5A7 7 0 1 0 14 19" />
      <Path d="M10 12H21" />
      <Path d="M17 8l4 4-4 4" />
    </Svg>
  );
}

export default function CustomerProfileScreen() {
  const { showAlert } = useAppAlert();
  const [savingContact, setSavingContact] = useState(false);
  const [showSavedItems, setShowSavedItems] = useState(false);
  const [savedItems, setSavedItems] = useState<{ id: string; name: string; imageUrl: string }[]>([]);
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
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [totalUnread, setTotalUnread] = useState<number>(0);
  const setUnreadMessageCount = useAppDataStore((s) => s.setUnreadMessageCount);
  const [isMeasurementsModalVisible, setIsMeasurementsModalVisible] = useState<boolean>(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState<boolean>(false);
  const [measurementsError, setMeasurementsError] = useState("");

  // Edit Personal Info state
  const [showPersonalInfo, setShowPersonalInfo] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState<boolean>(false);
  const [tempPhone, setTempPhone] = useState<string>(storedPhone || "");
  const [tempLocation, setTempLocation] = useState<string>(storedLocation || "Lagos, Nigeria");
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  const storeOrders = useOrdersStore((s) => s.orders);

  useEffect(() => {
    setTempPhone(storedPhone || "");
    setTempLocation(storedLocation || "Lagos, Nigeria");
  }, [storedPhone, storedLocation]);

  const loadMeasurements = useCallback(async () => {
    setLoadingMeasurements(true); setMeasurementsError("");
    try {
      const rows = await apiFetch<any[]>("/api/measurements/my-measurements", { silent: true });
      if (!Array.isArray(rows)) throw new Error("We couldn't read your measurements. Please try again.");
      setMeasurements(rows); setSavedSetsCount(measurementGroups(rows).length);
    } catch (error) { setMeasurementsError(error instanceof Error ? error.message : "We couldn't load your measurements."); }
    finally { setLoadingMeasurements(false); }
  }, []);
  const fetchStats = useCallback(async () => {
    try {
      const orders = await apiFetch<any[]>("/api/orders/my-orders", { silent: true }).catch(() => []);
      if (Array.isArray(orders) && orders.length > 0) {
        setOrdersCount(orders.length);
      } else {
        setOrdersCount(storeOrders.length);
      }
    } catch {
      setOrdersCount(storeOrders.length);
    }

    try {
      const prefs = await apiFetch<any>("/api/preferences", { silent: true }).catch(() => null);
      if (prefs) {
        setSavedItems(prefs.savedItems || []);
        setFavoritesCount(Array.isArray(prefs.savedItems) ? prefs.savedItems.length : 0);
        if (prefs.avgGiven !== undefined) setAvgGiven(Number(prefs.avgGiven).toFixed(1));
        if (prefs.phone) setPhone(prefs.phone);
        if (prefs.location) setLocation(prefs.location);
      }
    } catch { }

    await loadMeasurements();
  }, [storeOrders.length, setPhone, setLocation, loadMeasurements]);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
      // Fetch unread message count and sync to tab-bar badge store
      apiFetch<{ unreadCount: number; fashionHouseId: string; fashionHouseName: string; latestMessage: string; latestAt: string | null }[]>(
        "/api/direct-messages/my-threads",
        { silent: true }
      )
        .then((threads) => {
          if (Array.isArray(threads)) {
            const total = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
            setTotalUnread(total);
            setUnreadMessageCount(total);
          }
        })
        .catch(() => { });
    }, [fetchStats, setUnreadMessageCount])
  );

  const customerName = storedName?.trim()
    ? storedName.trim()
    : storedEmail?.trim()
      ? storedEmail.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : "Christianah James";

  const memberSinceText = React.useMemo(() => {
    if (!createdAt) return "Member since June 2025";
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "Member since June 2025";
    const formatted = formatMonthYear(d);
    return `Member since ${formatted}`;
  }, [createdAt]);

  const handleSaveContactInfo = async () => {
    const newPhone = tempPhone.trim();
    const newLocation = tempLocation.trim() || "Lagos, Nigeria";

    if (savingContact) return;
    setSavingContact(true);
    try {
      await apiFetch("/api/preferences", {
        method: "POST",
        body: JSON.stringify({ phone: newPhone, location: newLocation }),
        silent: true,
      });
      setPhone(newPhone);
      setLocation(newLocation);
      setIsEditingInfo(false);
      setShowPersonalInfo(false);
    } catch (error) {
      showAlert("Couldn't save settings", error instanceof Error ? error.message : "Please try again.");
    } finally { setSavingContact(false); }
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
      }
    } catch (e) {
      console.log("Profile auto detect error:", e);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={[
          { paddingBottom: 110 },
          isLandscape && { maxWidth: 840, alignSelf: "center", width: "100%", paddingHorizontal: 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ProfileDesignHeader />

        <ProfileMenuGroups>
          {/* Settings */}
          <Pressable onPress={() => { setIsEditingInfo(true); setShowPersonalInfo(true); }} className="flex-row items-center p-4 rounded-2xl min-h-[78px]">
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
              <ProfileDesignIcon name="settings" />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Profile
            </Text>
            <ChevronRight size={18} color="#2B2B2B" />
          </Pressable>

          {/* Measurement */}
          <Pressable
            onPress={() => { setIsMeasurementsModalVisible(true); void loadMeasurements(); }}
            className="flex-row items-center p-4 rounded-2xl min-h-[78px]"
          >
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
              <MeasurementIcon />
            </View>
            <View className="flex-1">
              <Text className="font-body text-[14px] text-black">
                Measurement
              </Text>
              <Text className="font-body text-[13px] text-black mt-0.5">
                {savedSetsCount} saved {savedSetsCount === 1 ? "set" : "sets"}
              </Text>
            </View>
            <ChevronRight size={18} color="#2B2B2B" />
          </Pressable>

          {/* My Messages */}
          <Pressable
            onPress={() => {
              // Opening the inbox does not mark every thread read. The backend
              // updates unread counts when the actual conversation is read.
              router.push("/(customer)/messages" as const);
            }}
            className="flex-row items-center p-4 rounded-2xl min-h-[78px]"
          >
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
              <MessagesIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">My Messages</Text>
            {totalUnread > 0 && (
              <View
                style={{
                  backgroundColor: '#F96951',
                  minWidth: 22,
                  height: 22,
                  borderRadius: 11,
                  paddingHorizontal: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#FFFDF9', fontSize: 11, fontFamily: 'InstrumentSans-Bold' }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Text>
              </View>
            )}
            <ChevronRight size={18} color="#2B2B2B" />
          </Pressable>


          {/* Favorite Houses */}
          <Pressable onPress={() => setShowSavedItems(true)} className="flex-row items-center p-4 rounded-2xl min-h-[78px]">
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
              <FavoritesIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Saved Items
            </Text>
            <ChevronRight size={18} color="#2B2B2B" />
          </Pressable>

          {/* Notifications */}
          <Pressable onPress={() => void Linking.openSettings().catch(() => showAlert("Notification settings", "Open your device settings to manage Owuja notification permissions."))} className="flex-row items-center p-4 rounded-2xl min-h-[78px]">
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
              <NotificationsIcon />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Notifications
            </Text>
            <ChevronRight size={18} color="#2B2B2B" />
          </Pressable>

          {/* Log Out */}
          <Pressable
            onPress={() => {
              logout();
              router.replace("/(auth)/login");
            }}
            className="flex-row items-center p-4 rounded-2xl min-h-[78px]"
          >
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
              <LogOut size={20} color="#F96951" strokeWidth={1.6} />
            </View>
            <Text className="font-body text-[14px] text-black flex-1">
              Log Out
            </Text>
            <ChevronRight size={18} color="#2B2B2B" />
          </Pressable>
        </ProfileMenuGroups>
      </ScrollView>

      <Modal visible={showSavedItems} animationType="slide" onRequestClose={() => setShowSavedItems(false)}>
        <SafeAreaView className="flex-1 bg-white px-6">
          <View className="flex-row items-center justify-between py-5">
            <Text className="font-body text-xl text-black">Saved Items</Text>
            <Pressable accessibilityLabel="Close saved items" onPress={() => setShowSavedItems(false)}><X size={24} color="#453332" /></Pressable>
          </View>
          <ScrollView>
            {!savedItems.length && <Text className="font-body text-[#4A403B]">Tap the heart on a catalog item to save it here.</Text>}
            {savedItems.map(item => <Pressable key={item.id} className="flex-row items-center gap-4 p-4 mb-3 bg-white rounded-2xl" onPress={() => {
              setShowSavedItems(false);
              router.push({ pathname: "/(customer)/catalog/[id]", params: { id: item.id } });
            }}>
              <Image source={{ uri: item.imageUrl }} style={{ width: 60, height: 70, borderRadius: 8 }} />
              <Text className="flex-1 font-body text-black">{item.name}</Text>
              <ChevronRight size={18} color="#2B2B2B" />
            </Pressable>)}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <ProfileSettingsPopup visible={showPersonalInfo} onClose={() => { setShowPersonalInfo(false); setIsEditingInfo(false); }}>
        <KeyboardAwareScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Contact & Location Details Card */}
          <View className="bg-white rounded-2xl p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-3.5">
                  <User size={20} color="#F96951" strokeWidth={1.6} />
                </View>
                <Text className="font-body text-[15px] text-[#4A403B]">Personal Info</Text>
              </View>
              {!isEditingInfo ? (
                <Pressable
                  onPress={() => setIsEditingInfo(true)}
                  className="flex-row items-center bg-white px-3 py-1.5 rounded-full"
                >
                  <Edit2 size={13} color="#453332" style={{ marginRight: 4 }} />
                  <Text className="font-body text-[12px] text-black font-medium">Edit</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleSaveContactInfo}
                  disabled={savingContact}
                  className="flex-row items-center bg-tomato px-3.5 py-1.5 rounded-full"
                >
                  <Check size={13} color="#FFFDF9" style={{ marginRight: 4 }} />
                  <Text className="font-body text-[12px] text-white font-medium">{savingContact ? "Saving..." : "Save"}</Text>
                </Pressable>
              )}
            </View>

            {!isEditingInfo ? (
              <View className="gap-2.5">
                {/* Phone Display */}
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-cream items-center justify-center mr-3">
                    <Phone size={15} color="#453332" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-body text-[11px] text-black uppercase tracking-wide">Phone Number</Text>
                    <Text className="font-body text-[14px] text-black">
                      {storedPhone || "Add phone number"}
                    </Text>
                  </View>
                </View>

                <View className="h-[1px] bg-white" />

                {/* Location Display */}
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-cream items-center justify-center mr-3">
                    <MapPin size={15} color="#453332" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-body text-[11px] text-black uppercase tracking-wide">Location</Text>
                    <Text className="font-body text-[14px] text-black">
                      {storedLocation || "Lagos, Nigeria"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View className="gap-3 pt-1 w-full" style={{ width: "100%", alignSelf: "stretch" }}>
                {/* Phone Input */}
                <View style={{ width: "100%", alignSelf: "stretch" }}>
                  <PhoneInputWithCountry
                    label="Phone Number"
                    placeholder="801 234 5678"
                    value={tempPhone}
                    onChangePhone={setTempPhone}
                  />
                </View>

                {/* Location Input & Auto Detect */}
                <View style={{ width: "100%", alignSelf: "stretch" }}>
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="font-body text-[12px] text-black">Location</Text>
                    <Pressable
                      onPress={handleAutoDetectLocation}
                      className="flex-row items-center"
                    >
                      <Navigation size={12} color="#453332" style={{ marginRight: 3 }} />
                      <Text className="font-body text-[11px] text-black font-semibold">
                        {isDetecting ? "Detecting..." : "Auto-detect"}
                      </Text>
                      {isDetecting && <ActivityIndicator size="small" color="#453332" style={{ marginLeft: 4 }} />}
                    </Pressable>
                  </View>
                  <TextInput
                    value={tempLocation}
                    onChangeText={setTempLocation}
                    placeholder="e.g. Lagos, Nigeria"
                    style={{ height: 46, width: "100%", alignSelf: "stretch" }}
                    className="bg-white border border-[#FFFDF9] rounded-xl px-3.5 text-[14px] text-black font-body"
                  />
                </View>
              </View>
            )}
          </View>

        </KeyboardAwareScrollView>
      </ProfileSettingsPopup>

      <CustomerMeasurementsModal visible={isMeasurementsModalVisible} onClose={() => setIsMeasurementsModalVisible(false)} rows={measurements} loading={loadingMeasurements} error={measurementsError} onRetry={() => { void loadMeasurements(); }} />
    </SafeAreaView>
  );
}


