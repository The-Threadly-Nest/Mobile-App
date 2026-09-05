import React, { useState, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  Text,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { X, UserCheck } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { escalationsApi } from "@/shared/utils/apiClient";

interface BookingItem {
  id: string;
  customerName: string;
  serviceTitle: string;
  appointmentTime: string;
  summary: string;
  status: "pending" | "assigned" | "declined";
  assignedStaffName?: string;
  createdAt: string;
}

interface MessageTurn {
  role: "user" | "model";
  text: string;
}

interface StaffMember {
  id: string;
  email: string;
  active: boolean;
}

// Default luxury demo bookings matching mockup
const INITIAL_BOOKINGS: BookingItem[] = [
  {
    id: "b1",
    customerName: "Chiamaka O.",
    serviceTitle: "Bridal Aso-Ebi",
    appointmentTime: "Sat, Sept 6, 10:00 AM",
    summary: "Client requesting bespoke corseted bridal Aso-Ebi for traditional wedding.",
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "b2",
    customerName: "Blessing A.",
    serviceTitle: "Bridal Gown",
    appointmentTime: "Mon, Sept 8, 11:00 AM",
    summary: "Client exploring custom ivory lace mermaid bridal gown with cathedral train.",
    status: "pending",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "b3",
    customerName: "Ifeoma N.",
    serviceTitle: "Aso-Ebi (2 pcs)",
    appointmentTime: "Wed, Sept 10, 1:00 PM",
    summary: "Two-piece embellished lace and silk velvet ensemble for royal coronation.",
    status: "pending",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "b4",
    customerName: "Jessica B.",
    serviceTitle: "Bridal Gown",
    appointmentTime: "Thur, Sept 11, 6:00 PM",
    summary: "First fitting session for structured couture gown with crystal beading.",
    status: "pending",
    createdAt: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "b5",
    customerName: "Adaobi E.",
    serviceTitle: "Luxury Kaftan",
    appointmentTime: "Tue, Sept 2, 2:00 PM",
    summary: "Gold hand-embroidered crepe kaftan with custom neckline.",
    status: "assigned",
    assignedStaffName: "Senior Tailor Joy",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "b6",
    customerName: "Zainab K.",
    serviceTitle: "Corseted Evening Gown",
    appointmentTime: "Fri, Sept 5, 4:00 PM",
    summary: "Black silk velvet gown with sweetheart neckline.",
    status: "assigned",
    assignedStaffName: "Master Cutter Emeka",
    createdAt: new Date(Date.now() - 90000000).toISOString(),
  },
  {
    id: "b7",
    customerName: "Funke A.",
    serviceTitle: "Ready-to-Wear Alteration",
    appointmentTime: "Mon, Aug 25, 11:00 AM",
    summary: "Schedule conflict outside available atelier opening hours.",
    status: "declined",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function BookingsScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert, showConfirm } = useAppAlert();

  const [activeTab, setActiveTab] = useState<"pending" | "assigned" | "declined">("pending");
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign Staff Modal
  const [assigningBooking, setAssigningBooking] = useState<BookingItem | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  // Transcript Detail Modal
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [transcript, setTranscript] = useState<MessageTurn[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const token = useAuthStore((s) => s.token);

  const fetchBackendData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [escRes, staffRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/escalations`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/staff`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (staffRes.status === "fulfilled" && staffRes.value.ok) {
        const staffData = await staffRes.value.json();
        if (Array.isArray(staffData)) setStaffList(staffData);
      }

      if (escRes.status === "fulfilled" && escRes.value.ok) {
        const data = await escRes.value.json();
        if (Array.isArray(data)) {
          const seen = new Set<string>();
          const mapped: BookingItem[] = [];

          for (const item of data) {
            const emailName = item.customer?.email ? item.customer.email.split("@")[0] : "Client";
            const formattedName = item.customerName || emailName.charAt(0).toUpperCase() + emailName.slice(1);
            const key = item.id || `${formattedName}-${item.reason}`;
            if (seen.has(key)) continue;
            seen.add(key);

            mapped.push({
              id: item.id,
              customerName: formattedName,
              serviceTitle: item.reason ? item.reason.replace(/_/g, " ") : "Bespoke Fitting",
              appointmentTime: item.preferredDate
                ? `${new Date(item.preferredDate).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}${item.preferredTime ? `, ${item.preferredTime}` : ""}`
                : new Date(item.createdAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }),
              summary: item.summary || "Client scheduled fitting appointment via AI Concierge.",
              status:
                item.bookingStatus === "declined"
                  ? "declined"
                  : item.resolved
                  ? "assigned"
                  : "pending",
              createdAt: item.createdAt,
            });
          }
          setBookings(mapped);
        }
      }
    } catch (e) {
      console.warn("Could not fetch bookings from server", e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchBackendData();
    }, [token])
  );

  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const assignedCount = bookings.filter((b) => b.status === "assigned").length;
  const declinedCount = bookings.filter((b) => b.status === "declined").length;

  const currentList = bookings.filter((b) => b.status === activeTab);

  const handleOpenAssign = async (booking: BookingItem) => {
    try {
      if (token) {
        const res = await fetch(`${API_BASE_URL}/api/measurements/check/${encodeURIComponent(booking.customerName)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.hasMeasurements === false) {
            router.push({
              pathname: "/(admin)/measurements/new",
              params: {
                bookingId: booking.id,
                customerName: booking.customerName,
                serviceTitle: booking.serviceTitle,
                appointmentTime: booking.appointmentTime,
                returnToAssign: "true",
              },
            } as any);
            return;
          }
        }
      }
    } catch {
      // Fallback directly to assign screen if check fails
    }

    router.push({
      pathname: "/(admin)/escalations/assign",
      params: {
        bookingId: booking.id,
        customerName: booking.customerName,
        serviceTitle: booking.serviceTitle,
        appointmentTime: booking.appointmentTime,
      },
    });
  };

  const handleConfirmAssign = async (staffName?: string) => {
    if (!assigningBooking) return;
    const name = staffName || (staffList[0]?.email ? staffList[0].email.split("@")[0] : "Lead Tailor");

    setBookings((prev) =>
      prev.map((b) =>
        b.id === assigningBooking.id
          ? { ...b, status: "assigned", assignedStaffName: name }
          : b
      )
    );
    setAssignModalVisible(false);
    setAssigningBooking(null);
    showAlert("Booking Assigned", `${assigningBooking.customerName}'s fitting has been assigned to ${name}.`);
  };

  const handleDecline = (booking: BookingItem) => {
    showConfirm(
      "Decline Booking",
      `Are you sure you want to decline the appointment for ${booking.customerName}?`,
      {
        confirmLabel: "Decline",
        cancelLabel: "Cancel",
        onConfirm: async () => {
          // Optimistic local update first
          setBookings((prev) =>
            prev.map((b) => (b.id === booking.id ? { ...b, status: "declined" } : b))
          );
          try {
            await escalationsApi.declineBooking(booking.id);
            showAlert("Booking Declined", `Appointment for ${booking.customerName} moved to Declined.`);
          } catch {
            // Revert optimistic update on failure
            setBookings((prev) =>
              prev.map((b) => (b.id === booking.id ? { ...b, status: "pending" } : b))
            );
            showAlert("Error", "Could not decline the booking. Please try again.");
          }
        },
      }
    );
  };

  const handleOpenTranscript = async (booking: BookingItem) => {
    setSelectedBooking(booking);
    setTranscript([]);
    setDetailModalVisible(true);
    setLoadingTranscript(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/escalations/${booking.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript ?? []);
      }
    } catch {
      // Fallback preview
      setTranscript([
        { role: "model", text: "Welcome to our Atelier. How may I assist you today?" },
        { role: "user", text: `I would like to book a fitting for ${booking.serviceTitle}.` },
        { role: "model", text: `Splendid. We have an opening on ${booking.appointmentTime}. Shall I reserve this for you?` },
        { role: "user", text: "Yes please, that time works perfectly!" },
      ]);
    } finally {
      setLoadingTranscript(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Screen Title */}
        <Text style={styles.screenTitle}>Bookings</Text>

        {/* Filter Pills Row */}
        <View style={styles.pillsRow}>
          <Pressable
            onPress={() => setActiveTab("pending")}
            style={({ pressed }) => [
              styles.pill,
              activeTab === "pending" ? styles.pillActive : styles.pillInactive,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                activeTab === "pending" ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              Pending ({pendingCount})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("assigned")}
            style={({ pressed }) => [
              styles.pill,
              activeTab === "assigned" ? styles.pillActive : styles.pillInactive,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                activeTab === "assigned" ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              Assigned ({assignedCount})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("declined")}
            style={({ pressed }) => [
              styles.pill,
              activeTab === "declined" ? styles.pillActive : styles.pillInactive,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                activeTab === "declined" ? styles.pillTextActive : styles.pillTextInactive,
              ]}
            >
              Declined ({declinedCount})
            </Text>
          </Pressable>
        </View>

        {/* Bookings List */}
        {loading && bookings.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color="#4A080C" size="large" />
          </View>
        ) : (
          <FlatList
            data={currentList}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const initial = (item.customerName || "C").charAt(0).toUpperCase();

              return (
                <Pressable
                  onPress={() => handleOpenTranscript(item)}
                  style={({ pressed }) => [
                    styles.card,
                    { opacity: pressed ? 0.96 : 1 },
                  ]}
                >
                  {/* Top Customer Info Row */}
                  <View style={styles.cardHeader}>
                    {/* Avatar Initial */}
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>

                    {/* Customer Info */}
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{item.customerName}</Text>
                      <Text style={styles.serviceSubtitle} numberOfLines={1}>
                        {item.serviceTitle}  •  {item.appointmentTime}
                      </Text>
                    </View>

                    {/* Status Badge */}
                    <View
                      style={[
                        styles.badge,
                        item.status === "assigned" && styles.badgeAssigned,
                        item.status === "declined" && styles.badgeDeclined,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          item.status === "assigned" && styles.badgeTextAssigned,
                          item.status === "declined" && styles.badgeTextDeclined,
                        ]}
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Text>
                    </View>
                  </View>

                  {/* Action Buttons for Pending */}
                  {item.status === "pending" && (
                    <View style={styles.actionsRow}>
                      <Pressable
                        onPress={() => handleOpenAssign(item)}
                        style={({ pressed }) => [
                          styles.assignBtn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Text style={styles.assignBtnText}>Assign</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => handleDecline(item)}
                        style={({ pressed }) => [
                          styles.declineBtn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Assigned Footer */}
                  {item.status === "assigned" && (
                    <View style={styles.assignedFooter}>
                      <UserCheck size={14} color="#15803D" />
                      <Text style={styles.assignedFooterText}>
                        Assigned to {item.assignedStaffName || "Lead Tailor"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {/* Staff Assignment Modal */}
      <Modal visible={assignModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Tailor</Text>
              <Pressable onPress={() => setAssignModalVisible(false)}>
                <X size={20} color="#4A080C" />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              Select a team member for {assigningBooking?.customerName}'s fitting:
            </Text>

            {staffList.length === 0 ? (
              <View style={{ marginVertical: 12 }}>
                <Pressable
                  onPress={() => handleConfirmAssign("Lead Atelier Stylist")}
                  style={styles.staffItem}
                >
                  <Text style={styles.staffItemName}>Lead Atelier Stylist (You)</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleConfirmAssign("Master Cutter")}
                  style={styles.staffItem}
                >
                  <Text style={styles.staffItemName}>Master Cutter</Text>
                </Pressable>
              </View>
            ) : (
              staffList.map((st) => (
                <Pressable
                  key={st.id}
                  onPress={() => handleConfirmAssign(st.email.split("@")[0])}
                  style={styles.staffItem}
                >
                  <Text style={styles.staffItemName}>{st.email}</Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>

      {/* Transcript Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fitting Request</Text>
              <Pressable onPress={() => setDetailModalVisible(false)}>
                <X size={20} color="#4A080C" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>AI Concierge Summary</Text>
                <Text style={styles.summaryText}>{selectedBooking?.summary}</Text>
              </View>

              <Text style={styles.transcriptSectionTitle}>Conversation Exchanges</Text>

              {loadingTranscript ? (
                <ActivityIndicator color="#4A080C" style={{ marginVertical: 20 }} />
              ) : (
                transcript.map((t, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.chatBubble,
                      t.role === "user" ? styles.userBubble : styles.modelBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chatText,
                        t.role === "user" ? styles.userChatText : styles.modelChatText,
                      ]}
                    >
                      {t.text}
                    </Text>
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  containerLandscape: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  screenTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#1A1110",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: "#4A080C",
  },
  pillInactive: {
    backgroundColor: "#E2E5DF",
  },
  pillText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  pillTextInactive: {
    color: "#474E51",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 2,
  },
  serviceSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
  },
  badge: {
    backgroundColor: "#F4ECE1",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  badgeAssigned: {
    backgroundColor: "#EAF5EA",
  },
  badgeDeclined: {
    backgroundColor: "#FDEAEA",
  },
  badgeText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 12,
    color: "#A4895C",
  },
  badgeTextAssigned: {
    color: "#15803D",
  },
  badgeTextDeclined: {
    color: "#DC2626",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  assignBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  assignBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  declineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#4A080C",
  },
  assignedFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 8, 12, 0.08)",
  },
  assignedFooterText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 13,
    color: "#15803D",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FBF7EF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#4A080C",
  },
  modalSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#5C4A32",
    marginBottom: 14,
  },
  staffItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.15)",
  },
  staffItemName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#1A1110",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.1)",
  },
  summaryLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    color: "#8A7550",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#1A1110",
    lineHeight: 20,
  },
  transcriptSectionTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#4A080C",
    marginBottom: 10,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    maxWidth: "85%",
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#4A080C",
  },
  modelBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.1)",
  },
  chatText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
  },
  userChatText: {
    color: "#FFFFFF",
  },
  modelChatText: {
    color: "#1A1110",
  },
});
