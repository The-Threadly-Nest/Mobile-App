import React, { useState, useCallback } from "react";
import {
  View,
  Pressable,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Users,
  Ruler,
  UserCheck,
  PenTool,
  FileText,
  Settings,
  Tag,
  Bell,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
  MessageSquare,
  Calendar,
  Clock,
  Trash2,
  X,
  Plus,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { adminApi, slotsApi, staffApi } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { ProfileDesignHeader, ProfileDesignIcon, ProfileMenuGroups } from "@/shared/components/ProfileDesign";
import AdminProfileEditScreen from "./profile-edit";

export default function AdminSettingsScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert, showConfirm } = useAppAlert();

  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const token = useAuthStore((s) => s.token);
  const storedShopName = useAuthStore((s) => s.shopName);
  const shopLogo = useAuthStore((s) => s.shopLogo);
  const [businessName, setBusinessName] = useState(storedShopName || name || "");

  const [staffCount, setStaffCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);

  // Fitting slots state & management
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [slotsList, setSlotsList] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(60);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const data = await slotsApi.getSlots();
      if (Array.isArray(data)) {
        setSlotsList(data);
      }
    } catch (err) {
      console.warn("Could not fetch fitting slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleAddSlot = async () => {
    if (!newSlotDate.trim() || !newSlotTime.trim()) {
      showAlert("Missing Fields", "Use YYYY-MM-DD for the date and HH:MM for the time.");
      return;
    }
    setAddingSlot(true);
    try {
      const created = await slotsApi.createSlot(newSlotDate.trim(), newSlotTime.trim(), slotDurationMinutes);
      setSlotsList((prev) => [...prev, created]);
      setNewSlotDate("");
      setNewSlotTime("");
      showAlert("Slot Added", `${created.label || `${created.date} at ${created.time}`} is now available.`);
    } catch (err: any) {
      showAlert("Add Failed", err?.message || "Could not add fitting slot.");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await slotsApi.deleteSlot(slotId);
      setSlotsList((prev) => prev.filter((s) => s.id !== slotId));
    } catch (err: any) {
      showAlert("Error", err?.message || "Could not delete slot.");
    }
  };

  useFocusEffect(useCallback(() => {
    async function loadData() {
      if (!token) return;
      try {
        const [profileRes, summaryRes, staffRes] = await Promise.allSettled([
          adminApi.getProfile(),
          adminApi.getSummary(),
          staffApi.getStaff(),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
          const house = profileRes.value.fashionHouse;
          if (house.shopName || house.name) {
            setBusinessName(house.shopName || house.name);
          }
          setSlotDurationMinutes(house.slotDurationMinutes || 60);
        }

        if (summaryRes.status === "fulfilled") {
          setStaffCount(summaryRes.value.staffCount);
          setCustomerCount(summaryRes.value.customerCount);
          setInvoiceCount(summaryRes.value.invoiceCountThisMonth);
        }

        if (staffRes.status === "fulfilled" && Array.isArray(staffRes.value)) {
          const totalUnread = staffRes.value.reduce((acc: number, st: any) => acc + (st.unreadCount || 0), 0);
          setUnreadChatCount(totalUnread);
        }
      } catch (err) {
        console.warn("Failed to load profile for settings", err);
      }
    }
    loadData();
  }, [token]));

  const emailPrefix = email ? email.split("@")[0] : "";
  const fallbackName = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    : "Fashion House";
  const displayTitle = businessName || fallbackName;

  const handleLogout = () => {
    showConfirm("Log Out", "Are you sure you want to log out of your Owuja account?", {
      confirmLabel: "Log Out",
      cancelLabel: "Cancel",
      onConfirm: () => {
        logout();
        router.replace("/(auth)/login");
      },
    });
  };

  // All features styled consistently in the 2-column grid
  const ALL_GRID_ITEMS = [
    {
      id: "staff",
      title: "Staff",
      subtitle: staffCount > 0 ? `${staffCount} member${staffCount === 1 ? "" : "s"}` : "Manage team",
      badge: unreadChatCount > 0 ? unreadChatCount : undefined,
      icon: UserCheck,
      onPress: () => router.push("/(admin)/staff" as any),
    },
    {
      id: "customers",
      title: "Customers",
      subtitle: `${customerCount} total`,
      icon: Users,
      onPress: () => router.push("/(admin)/customers" as any),
    },
    {
      id: "measurements",
      title: "Measurements",
      subtitle: "New entry",
      icon: Ruler,
      onPress: () => router.push("/(admin)/measurements/new" as any),
    },
    {
      id: "moodboards",
      title: "Moodboards",
      subtitle: "Cross-staff view",
      icon: PenTool,
      onPress: () => router.push("/(admin)/moodboard" as any),
    },
    {
      id: "invoices",
      title: "Invoices",
      subtitle: `${invoiceCount} this month`,
      icon: FileText,
      onPress: () => router.push("/(admin)/invoices" as any),
    },
    {
      id: "catalog",
      title: "Catalog",
      subtitle: "Upload & manage clothes",
      icon: Tag,
      onPress: () => router.push("/(admin)/catalog" as any),
    },
    {
      id: "chat",
      title: "Chat",
      subtitle: "Staff & customer messages",
      icon: MessageSquare,
      onPress: () => router.push("/(admin)/messages" as any),
    },
    {
      id: "fitting-slots",
      title: "Fitting Slots",
      subtitle: "Manage AI booking times",
      icon: Calendar,
      onPress: () => { setShowSlotsModal(true); void fetchSlots(); },
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Store & profile",
      icon: Settings,
      onPress: () => setShowSettingsModal(true),
    },
    {
      id: "notifications",
      title: "Notifications",
      subtitle: "Alerts & updates",
      icon: Bell,
      onPress: () => void Linking.openSettings().catch(() => showAlert("Notification settings", "Open your device settings to manage Owuja notification permissions.")),
    },
    {
      id: "support",
      title: "Support",
      subtitle: "Concierge & help",
      icon: HelpCircle,
      onPress: () => showAlert("Support", "Need assistance? Contact us at support@owuja.com"),
    },
    {
      id: "privacy",
      title: "Privacy",
      subtitle: "Data & security",
      icon: Shield,
      onPress: () => showAlert("Privacy Policy", "All customer data & measurements are encrypted under tenant isolation."),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.landscapeContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Header */}
        <ProfileDesignHeader balance="Unavailable" />

        <ProfileMenuGroups>

        {/* 2. Unified 2-Column Grid */}

          {[...ALL_GRID_ITEMS.filter(item => item.id === "settings"),
            ...ALL_GRID_ITEMS.filter(item => item.id !== "settings")].map((item: any) => {
            const IconComponent = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.gridCard,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                {/* Squircle Icon Container */}
                <View style={styles.iconContainer}>
                  {item.id === "settings" ? <ProfileDesignIcon name="settings" />
                    : item.id === "support" ? <ProfileDesignIcon name="reviews" />
                    : <IconComponent size={21.2217} strokeWidth={1.4} color="#F96951" />}
                  {item.badge ? (
                    <View
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        backgroundColor: "#D32F2F",
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        paddingHorizontal: 5,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1.5,
                        borderColor: "#FFFFFF",
                        zIndex: 10,
                      }}
                    >
                      <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#FFFFFF" }}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Text Content */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
                <ProfileDesignIcon name="chevron" />
              </Pressable>
            );
          })}

          {/* 3. Log Out Card in Grid Format */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.gridCard,
              styles.logoutGridCard,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.iconContainer, styles.logoutIconContainer]}>
              <ProfileDesignIcon name="logout" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: "#DC2626" }]}>Log Out</Text>
              <Text style={styles.cardSubtitle}>Sign out

              </Text>
            </View>
            <ProfileDesignIcon name="chevron" />
          </Pressable>
        </ProfileMenuGroups>
      </ScrollView>

      {/* Fitting Slots Management Modal */}
      <Modal visible={showSettingsModal} animationType="slide" onRequestClose={() => setShowSettingsModal(false)}>
        {showSettingsModal && <AdminProfileEditScreen onClose={() => {
          setShowSettingsModal(false);
          setBusinessName(useAuthStore.getState().shopName || "");
        }} />}
      </Modal>
      <Modal
        visible={showSlotsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSlotsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" }}>
            {/* Modal Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: "HedvigLettersSerif-Regular", fontSize: 20, color: "#453332" }}>
                  Fitting Time Slots
                </Text>
                <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#8A7550" }}>
                  Manage available slots for AI booking assistant
                </Text>
              </View>
              <Pressable
                onPress={() => setShowSlotsModal(false)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(58, 46, 26, 0.08)", justifyContent: "center", alignItems: "center" }}
              >
                <X size={18} color="#3A2E1A" />
              </Pressable>
            </View>

            {/* Add New Slot Form */}
            <View style={{ backgroundColor: "#FFFFFF", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#E4D5B7", marginBottom: 16 }}>
              <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#3A2E1A", marginBottom: 10 }}>
                Add New Fitting Slot
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 10, height: 42, borderWidth: 1, borderColor: "#E4D5B7" }}>
                  <Calendar size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#3A2E1A" }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#A09075"
                    value={newSlotDate}
                    onChangeText={setNewSlotDate}
                  />
                </View>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 10, height: 42, borderWidth: 1, borderColor: "#E4D5B7" }}>
                  <Clock size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#3A2E1A" }}
                    placeholder="HH:MM"
                    placeholderTextColor="#A09075"
                    value={newSlotTime}
                    onChangeText={setNewSlotTime}
                  />
                </View>
              </View>

              <Pressable
                onPress={handleAddSlot}
                disabled={addingSlot}
                style={({ pressed }) => [{
                  backgroundColor: "#453332",
                  height: 40,
                  borderRadius: 10,
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: pressed || addingSlot ? 0.8 : 1,
                }]}
              >
                {addingSlot ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#FFFFFF" }}>
                    + Add Slot
                  </Text>
                )}
              </Pressable>
            </View>

            {/* List of Existing Slots */}
            <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#3A2E1A", marginBottom: 10 }}>
              Active Slots ({slotsList.length})
            </Text>

            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {loadingSlots ? (
                <ActivityIndicator color="#453332" style={{ marginVertical: 20 }} />
              ) : slotsList.length === 0 ? (
                <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#8A7550", textAlign: "center", marginVertical: 16 }}>
                  No fitting slots configured yet. Add your first slot above!
                </Text>
              ) : (
                slotsList.map((slot) => (
                  <View
                    key={slot.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "#FFFFFF",
                      padding: 12,
                      borderRadius: 12,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: "rgba(58, 46, 26, 0.08)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Calendar size={16} color="#453332" />
                      <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#3A2E1A" }}>
                        {slot.label || `${slot.date} · ${slot.time}`}
                      </Text>
                      {slot.booked ? (
                        <View style={{ backgroundColor: "#FDE8E8", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#D32F2F" }}>Booked</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: "#E8F5E9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#2E7D32" }}>Available</Text>
                        </View>
                      )}
                    </View>

                    <Pressable
                      onPress={() => handleDeleteSlot(slot.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, padding: 4 }]}
                    >
                      <Trash2 size={16} color="#D32F2F" />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 120,
  },
  landscapeContainer: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  screenTitle: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 28,
    color: "#1A1110",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  accountCard: {
    backgroundColor: "#F6F6F6",
    borderRadius: 15,
    marginHorizontal: 0,
    padding: 18,
    marginBottom: 0,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 10,
    elevation: 0,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 20,
    color: "#FFFFFF",
  },
  accountName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 2,
  },
  accountEmail: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#8A7550",
  },
  gridContainer: {
    paddingHorizontal: 24,
    gap: 14,
  },
  gridCard: {
    width: "100%",
    backgroundColor: "#F6F6F6",
    borderRadius: 15,
    padding: 15,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 10,
    elevation: 0,
  },
  logoutGridCard: {
    borderWidth: 0,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    position: "relative",
  },
  logoutIconContainer: {
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    color: "#7A7265",
  },
});
