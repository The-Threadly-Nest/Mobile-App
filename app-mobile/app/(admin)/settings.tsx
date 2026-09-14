import React, { useState, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
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
import { adminApi, ordersApi, slotsApi } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

import { API_BASE_URL } from "@/api/config";

export default function AdminSettingsScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert, showConfirm } = useAppAlert();

  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const token = useAuthStore((s) => s.token);
  const storedShopName = useAuthStore((s) => s.shopName);
  const [businessName, setBusinessName] = useState(storedShopName || name || "");

  const [staffCount, setStaffCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);

  // Fitting slots state & management
  const [showSlotsModal, setShowSlotsModal] = useState(false);
  const [slotsList, setSlotsList] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);

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
      showAlert("Missing Fields", "Please enter both date (e.g. Sat, 12 Sep) and time (e.g. 10:00 AM).");
      return;
    }
    setAddingSlot(true);
    try {
      const created = await slotsApi.createSlot(newSlotDate.trim(), newSlotTime.trim());
      setSlotsList((prev) => [...prev, created]);
      setNewSlotDate("");
      setNewSlotTime("");
      showAlert("Slot Added", `Fitting slot for ${created.date} at ${created.time} is now available.`);
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

  useEffect(() => {
    async function loadData() {
      if (!token) return;
      try {
        const [profileRes, ordersRes, staffRes, customersRes] = await Promise.allSettled([
          adminApi.getProfile(),
          ordersApi.getOrders(),
          fetch(`${API_BASE_URL}/api/staff`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
          fetch(`${API_BASE_URL}/api/customers`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
          const house = profileRes.value.fashionHouse;
          if (house.shopName || house.name) {
            setBusinessName(house.shopName || house.name);
          }
        }

        if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) {
          setInvoiceCount(ordersRes.value.length);
        }

        if (staffRes.status === "fulfilled" && Array.isArray(staffRes.value)) {
          setStaffCount(staffRes.value.length);
          const totalUnread = staffRes.value.reduce((acc: number, st: any) => acc + (st.unreadCount || 0), 0);
          setUnreadChatCount(totalUnread);
        }

        if (customersRes.status === "fulfilled" && Array.isArray(customersRes.value)) {
          setCustomerCount(customersRes.value.length);
        }
      } catch (err) {
        console.warn("Failed to load profile for settings", err);
      }
    }
    loadData();
  }, [token]);

  const emailPrefix = email ? email.split("@")[0] : "";
  const fallbackName = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    : "Fashion House";
  const displayTitle = businessName || fallbackName;

  const handleLogout = () => {
    showConfirm("Log Out", "Are you sure you want to log out of your Threadly Nest account?", {
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
      subtitle: staffCount > 0 ? `${staffCount} member${staffCount === 1 ? "" : "s"}` : "Manage & chat",
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
      id: "customer-inquiries",
      title: "Customer Inquiries",
      subtitle: "Client direct messages",
      icon: MessageSquare,
      onPress: () => router.push("/(admin)/customer-messages" as any),
    },
    {
      id: "fitting-slots",
      title: "Fitting Slots",
      subtitle: "Manage AI booking times",
      icon: Calendar,
      onPress: () => {
        fetchSlots();
        setShowSlotsModal(true);
      },
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Store & profile",
      icon: Settings,
      onPress: () => router.push("/(admin)/profile-edit" as any),
    },
    {
      id: "notifications",
      title: "Notifications",
      subtitle: "Alerts & updates",
      icon: Bell,
      onPress: () => showAlert("Notifications", "Push notifications for new bookings and order updates are active."),
    },
    {
      id: "support",
      title: "Support",
      subtitle: "Concierge & help",
      icon: HelpCircle,
      onPress: () => showAlert("Support", "Need assistance? Contact our concierge team at concierge@threadlynest.com"),
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
        <Text style={styles.screenTitle}>More</Text>

        {/* 1. Account & Atelier Card at the TOP */}
        <Pressable
          onPress={() => router.push("/(admin)/profile-edit" as any)}
          style={({ pressed }) => [
            styles.accountCard,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayTitle.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName} numberOfLines={1}>
              {displayTitle}
            </Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {email || "admin@threadlynest.com"}
            </Text>
          </View>
          <ChevronRight size={18} color="#8A7550" />
        </Pressable>

        {/* 2. Unified 2-Column Grid */}
        <View style={styles.gridContainer}>
          {ALL_GRID_ITEMS.map((item: any) => {
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
                  <IconComponent size={22} color="#1A1110" />
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
                      <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#FFFFFF" }}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Text Content */}
                <View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
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
              <LogOut size={22} color="#DC2626" />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: "#DC2626" }]}>Log Out</Text>
              <Text style={styles.cardSubtitle}>Sign out

              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Fitting Slots Management Modal */}
      <Modal
        visible={showSlotsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSlotsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FBF7EF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" }}>
            {/* Modal Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: "Fraunces-SemiBold", fontSize: 20, color: "#4A080C" }}>
                  Fitting Time Slots
                </Text>
                <Text style={{ fontFamily: "WorkSans_400Regular", fontSize: 12, color: "#8A7550" }}>
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
              <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#3A2E1A", marginBottom: 10 }}>
                Add New Fitting Slot
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FBF7EF", borderRadius: 10, paddingHorizontal: 10, height: 42, borderWidth: 1, borderColor: "#E4D5B7" }}>
                  <Calendar size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#3A2E1A" }}
                    placeholder="Sat, 12 Sep"
                    placeholderTextColor="#A09075"
                    value={newSlotDate}
                    onChangeText={setNewSlotDate}
                  />
                </View>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FBF7EF", borderRadius: 10, paddingHorizontal: 10, height: 42, borderWidth: 1, borderColor: "#E4D5B7" }}>
                  <Clock size={14} color="#8A7550" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#3A2E1A" }}
                    placeholder="10:00 AM"
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
                  backgroundColor: "#4A080C",
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
                  <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#FFFFFF" }}>
                    + Add Slot
                  </Text>
                )}
              </Pressable>
            </View>

            {/* List of Existing Slots */}
            <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#3A2E1A", marginBottom: 10 }}>
              Active Slots ({slotsList.length})
            </Text>

            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {loadingSlots ? (
                <ActivityIndicator color="#4A080C" style={{ marginVertical: 20 }} />
              ) : slotsList.length === 0 ? (
                <Text style={{ fontFamily: "WorkSans_400Regular", fontSize: 13, color: "#8A7550", textAlign: "center", marginVertical: 16 }}>
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
                      <Calendar size={16} color="#4A080C" />
                      <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 13, color: "#3A2E1A" }}>
                        {slot.date} · {slot.time}
                      </Text>
                      {slot.booked ? (
                        <View style={{ backgroundColor: "#FDE8E8", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#D32F2F" }}>Booked</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: "#E8F5E9", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#2E7D32" }}>Available</Text>
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
    backgroundColor: "#FBF7EF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
  },
  landscapeContainer: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  screenTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#1A1110",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#FFFFFF",
  },
  accountName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 2,
  },
  accountEmail: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    minHeight: 140,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  logoutGridCard: {
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E4E1DB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    position: "relative",
  },
  logoutIconContainer: {
    backgroundColor: "#FEE2E2",
  },
  cardTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
});
