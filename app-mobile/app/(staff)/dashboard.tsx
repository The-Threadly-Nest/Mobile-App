import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

interface StaffOrder {
  id: string;
  customerName: string;
  orderNumber: string;
  garmentDetails: string;
  dueDate: string;
  status: string;
  progressPercent: number;
}

const getStagePercent = (status: string): number => {
  switch (status) {
    case "booked":
    case "order_placed":
    case "pending_admin_review":
      return 16;
    case "measurements_confirmed":
      return 35;
    case "fabric_sourced":
      return 50;
    case "in_production":
      return 70;
    case "quality_check":
      return 85;
    case "ready_for_pickup":
    case "completed":
    case "delivered":
      return 100;
    default:
      return 25;
  }
};

const FALLBACK_STAFF_ORDERS: StaffOrder[] = [
  {
    id: "1",
    customerName: "Chiamaka O.",
    orderNumber: "#TFH-2291",
    garmentDetails: "Aso-Ebi (2 pcs)",
    dueDate: "Due Sep 27",
    status: "in_production",
    progressPercent: 80,
  },
  {
    id: "2",
    customerName: "Oluchi K.",
    orderNumber: "#TFH-2305",
    garmentDetails: "Kaftan",
    dueDate: "Due Oct 4",
    status: "measurements_confirmed",
    progressPercent: 40,
  },
  {
    id: "3",
    customerName: "Damilola R.",
    orderNumber: "#TFH-2312",
    garmentDetails: "Senator wear",
    dueDate: "Due Oct 6",
    status: "booked",
    progressPercent: 20,
  },
  {
    id: "4",
    customerName: "Funke A.",
    orderNumber: "#TFH-2280",
    garmentDetails: "Velvet Corset Gown",
    dueDate: "Due Sep 15",
    status: "completed",
    progressPercent: 100,
  },
  {
    id: "5",
    customerName: "Bisi T.",
    orderNumber: "#TFH-2274",
    garmentDetails: "Agbada Set (3 pcs)",
    dueDate: "Due Sep 10",
    status: "completed",
    progressPercent: 100,
  },
];

export default function StaffDashboard() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert } = useAppAlert();

  const storeName = useAuthStore((s) => s.name);
  const storeShopName = useAuthStore((s) => s.shopName);
  const setShopName = useAuthStore((s) => s.setShopName);
  const token = useAuthStore((s) => s.token);

  const [localShopName, setLocalShopName] = useState<string>(storeShopName || "Luxury Fashion House");
  const [activeTab, setActiveTab] = useState<"in_progress" | "completed">("in_progress");
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const displayName = storeName || "Staff Member";
  const displayShopName = localShopName || storeShopName || "Luxury Fashion House";

  // Compute greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const fetchStaffMe = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/staff/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.shopName) {
        setLocalShopName(data.shopName);
        setShopName(data.shopName);
      }
    } catch {
      // Keep existing shopName state
    }
  };

  const fetchOrders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        if (data.length > 0) {
          const seen = new Set<string>();
          const formatted: StaffOrder[] = [];

          data.forEach((o: any, idx: number) => {
            const custName = o.customer?.name || o.customerName || `Customer ${idx + 1}`;
            const key = o.id || `${custName}-${o.itemName || "garment"}`;
            if (!seen.has(key)) {
              seen.add(key);
              const orderStatus = o.status || "in_production";
              const isDone = orderStatus === "completed" || orderStatus === "delivered" || orderStatus === "ready_for_pickup";
              formatted.push({
                id: o.id,
                customerName: custName,
                orderNumber: `#TFH-${2290 + idx}`,
                garmentDetails: o.itemName || "Custom Garment",
                dueDate: "Due Soon",
                status: isDone ? "completed" : orderStatus,
                progressPercent: getStagePercent(orderStatus),
              });
            }
          });
          setOrders(formatted);
        } else {
          setOrders(FALLBACK_STAFF_ORDERS);
        }
      }
    } catch {
      setOrders(FALLBACK_STAFF_ORDERS);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      fetchStaffMe();
    }, [token])
  );

  // Smart Fallback: filter out mock/demo orders if real assigned orders exist
  const realOrders = orders.filter((o) => !o.id.startsWith("mock-") && !o.id.startsWith("demo-"));
  const effectiveOrders = realOrders.length > 0 ? realOrders : orders;

  const inProgressOrders = effectiveOrders.filter((o) => o.status !== "completed");
  const completedOrders = effectiveOrders.filter((o) => o.status === "completed");
  const displayedOrders = activeTab === "in_progress" ? inProgressOrders : completedOrders;

  const handleActionPress = (order: StaffOrder) => {
    router.push({
      pathname: "/(staff)/order-details",
      params: {
        orderId: order.id,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        garmentDetails: order.garmentDetails,
        dueDate: order.dueDate,
        initialStage: order.status,
      },
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "booked":
      case "order_placed":
      case "pending_admin_review":
        return "Booked";
      case "measurements_confirmed":
        return "Measurements Confirmed";
      case "fabric_sourced":
        return "Fabric Sourced";
      case "in_production":
        return "In Production";
      case "quality_check":
        return "Quality Check";
      case "ready_for_pickup":
        return "Ready for Pickup";
      case "completed":
      case "delivered":
        return "Completed";
      default:
        return status.replace(/_/g, " ").toUpperCase();
    }
  };

  const getActionButtonLabel = (_status: string) => {
    return "View Details";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.scrollContentLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Tag & Greeting */}
        <View style={styles.headerContainer}>
          <Text style={styles.atelierTag}>{displayShopName} · Staff</Text>
          <Text style={styles.greetingTitle}>
            {getGreeting()}, {displayName.split(" ")[0]}
          </Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          <Pressable
            onPress={() => setActiveTab("in_progress")}
            style={[
              styles.tabPill,
              activeTab === "in_progress" ? styles.activeTabPill : styles.inactiveTabPill,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "in_progress" ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              In progress ({inProgressOrders.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("completed")}
            style={[
              styles.tabPill,
              activeTab === "completed" ? styles.activeTabPill : styles.inactiveTabPill,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "completed" ? styles.activeTabText : styles.inactiveTabText,
              ]}
            >
              Completed ({completedOrders.length})
            </Text>
          </Pressable>
        </View>

        {/* Order Cards List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#4A080C" size="large" />
          </View>
        ) : (
          displayedOrders.map((order) => {
            const initial = order.customerName.charAt(0).toUpperCase();

            return (
              <View key={order.id} style={styles.cardContainer}>
                {/* Top Customer Info Row */}
                <View style={styles.cardHeaderRow}>
                  {/* Initial Circle */}
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>

                  <View style={styles.customerInfoCol}>
                    <Text style={styles.customerNameText}>
                      {order.customerName} <Text style={styles.orderNumberText}>· {order.orderNumber}</Text>
                    </Text>
                    <Text style={styles.garmentSubtext}>
                      {order.garmentDetails} · {order.dueDate}
                    </Text>
                  </View>
                </View>

                {/* Progress Track */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${order.progressPercent}%` },
                    ]}
                  />
                </View>

                {/* Status Label */}
                <Text style={styles.statusLabelText}>{getStatusLabel(order.status)}</Text>

                {/* Action Button */}
                <Pressable
                  onPress={() => handleActionPress(order)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.actionBtnText}>{getActionButtonLabel(order.status)}</Text>
                  <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  scrollContentLandscape: {
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  },
  headerContainer: {
    marginBottom: 20,
    marginTop: 8,
  },
  atelierTag: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
    marginBottom: 4,
  },
  greetingTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    lineHeight: 34,
    color: "#4A080C",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  tabPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTabPill: {
    backgroundColor: "#4A080C",
  },
  inactiveTabPill: {
    backgroundColor: "#EBE0D3",
  },
  tabText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  inactiveTabText: {
    color: "#3A2E1A",
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 18,
    color: "#FFFFFF",
  },
  customerInfoCol: {
    flex: 1,
  },
  customerNameText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3A2E1A",
    marginBottom: 2,
  },
  orderNumberText: {
    fontFamily: "WorkSans_500Medium",
    color: "#3A2E1A",
  },
  garmentSubtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(228, 213, 183, 0.6)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#C4A763",
    borderRadius: 3,
  },
  statusLabelText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    color: "#4A080C",
    marginBottom: 14,
  },
  actionBtn: {
    width: "100%",
    height: 52,
    borderRadius: 26,
    backgroundColor: "#4A080C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
});
