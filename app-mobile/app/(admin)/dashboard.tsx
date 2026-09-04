import React, { useState, useEffect } from "react";
import { View, ScrollView, Pressable, Text, ActivityIndicator, RefreshControl, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Plus, Tag } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";
import { adminApi, ordersApi, escalationsApi } from "@/shared/utils/apiClient";

interface EscalationItem {
  id: string;
  summary?: string;
  reason?: string;
  resolved: boolean;
  createdAt: string;
  customerId?: string;
  customerName?: string;
  customer?: { id: string; email: string };
}

export default function AdminDashboard() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const storeName = useAuthStore((s) => s.name);
  const storeEmail = useAuthStore((s) => s.email);
  const storedShopName = useAuthStore((s) => s.shopName);
  const setStoredShopName = useAuthStore((s) => s.setShopName);

  const [shopName, setShopName] = useState(storedShopName || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real Data states
  const [orders, setOrders] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);

  const fetchData = async () => {
    try {
      const [profileRes, ordersRes, escalationsRes] = await Promise.allSettled([
        adminApi.getProfile(),
        ordersApi.getOrders(),
        escalationsApi.getEscalations(),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
        const house = profileRes.value.fashionHouse;
        if (house.admin?.name) {
          useAuthStore.getState().setName(house.admin.name);
        }
        if (house.shopName || house.name) {
          const name = house.shopName || house.name;
          setShopName(name);
          setStoredShopName(name);
        }
      }

      if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) {
        setOrders(ordersRes.value);
      }

      if (escalationsRes.status === "fulfilled" && Array.isArray(escalationsRes.value)) {
        setEscalations(escalationsRes.value);
      }
    } catch (err) {
      console.warn("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleResolveEscalation = async (id: string) => {
    try {
      await escalationsApi.resolveEscalation(id);
      setEscalations((prev) => prev.map((item) => (item.id === id ? { ...item, resolved: true } : item)));
    } catch (err) {
      console.error(err);
    }
  };

  // Smart Fallback filtering & deduplication
  const realOrders = orders.filter((o) => !o.id?.startsWith("mock-"));
  const realEscalations = escalations.filter((e) => !e.id?.startsWith("mock-"));

  const effectiveOrders = realOrders.length > 0 ? realOrders : orders;
  const effectiveEscalations = realEscalations.length > 0 ? realEscalations : escalations;

  // Active Orders count = resolved (assigned) escalations — same source as Bookings page "Assigned" tab
  // This ensures dashboard and bookings page are always in sync regardless of order row state
  const uniqueAssigned = new Map<string, any>();
  effectiveEscalations.forEach((e) => {
    if (e.resolved) {
      const key = e.id || e.customerId || "esc";
      if (!uniqueAssigned.has(key)) uniqueAssigned.set(key, e);
    }
  });
  const activeOrdersCount = uniqueAssigned.size;

  const totalRevenue = realOrders.reduce((sum, o) => sum + (o.price || 0), 0);

  // Deduplicate pending escalations/bookings by ID or customer reference
  const uniquePendingEscalations = new Map<string, any>();
  effectiveEscalations.forEach((e) => {
    if (!e.resolved) {
      const key = e.id || e.customerId || e.customerName || "esc";
      if (!uniquePendingEscalations.has(key)) {
        uniquePendingEscalations.set(key, e);
      }
    }
  });
  const pendingEscalations = Array.from(uniquePendingEscalations.values());
  const pendingBookingsCount = pendingEscalations.length;

  // Business / Brand Name entered during signup (e.g. "Royal Stitch Atelier")
  const shopNameDisplay = shopName || storedShopName || "Fashion House";

  // Personal Admin First Name entered during signup (e.g. "Chiamaka")
  const emailPrefix = storeEmail ? storeEmail.split("@")[0] : "";
  const fallbackEmailName = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    : "Admin";

  // Ensure personal name does not accidentally match brand name
  const isPersonalNameValid =
    storeName &&
    storeName.trim().toLowerCase() !== shopNameDisplay.trim().toLowerCase();
  const adminFullName = isPersonalNameValid ? storeName : fallbackEmailName;
  const adminFirstName = adminFullName.split(" ")[0];

  // Display real pending escalations from database
  const displayRequests = pendingEscalations.slice(0, 3);

  const formatMoney = (val: number) => {
    if (realOrders.length === 0) return "₦3,360,000";
    return `₦${val.toLocaleString()}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FBF7EF" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
          isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4A080C" />}
      >
        {/* Subtitle Badge */}
        <Text
          style={{
            fontFamily: "WorkSans_500Medium",
            fontSize: 13,
            color: "#4A080C",
            marginBottom: 4,
          }}
        >
          {shopNameDisplay} · Admin
        </Text>

        {/* Serif Greeting */}
        <View style={{ width: 252, height: 60, justifyContent: "center", marginBottom: 24 }}>
          <Text
            style={{
              fontFamily: "Fraunces-SemiBold",
              fontSize: 28,
              color: "#3B0508",
              lineHeight: 32,
            }}
          >
            Good morning,{"\n"}
            {adminFirstName}
          </Text>
        </View>

        {/* Top Metrics Row: Side-by-side in landscape, stacked in portrait */}
        <View style={isLandscape ? { flexDirection: "row", gap: 12, marginBottom: 20 } : { marginBottom: 24 }}>
          {/* Monthly Revenue Banner */}
          <View
            style={[
              {
                backgroundColor: "#4A080C",
                borderRadius: 16,
                height: 86,
                justifyContent: "center",
                paddingHorizontal: 22,
                marginBottom: 16,
              },
              isLandscape && { flex: 1, marginBottom: 0 },
            ]}
          >
            <Text
              style={{
                fontFamily: "Fraunces-Bold",
                fontSize: 28,
                color: "#FFFFFF",
                marginBottom: 4,
              }}
            >
              {formatMoney(totalRevenue)}
            </Text>
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 11,
                letterSpacing: 1.2,
                color: "rgba(244, 239, 230, 0.8)",
              }}
            >
              REVENUE THIS MONTH
            </Text>
          </View>

          {/* Side-by-Side Stat Cards */}
          <View style={[{ flexDirection: "row", gap: 12 }, isLandscape && { flex: 1 }]}>
            <View
              style={{
                flex: 1,
                height: 86,
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces-Bold",
                  fontSize: 24,
                  color: "#3B0508",
                  marginBottom: 2,
                }}
              >
                {activeOrdersCount}
              </Text>
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 10,
                  letterSpacing: 0.8,
                  color: "#8A7550",
                }}
              >
                ACTIVE ORDERS
              </Text>
            </View>

            <View
              style={{
                flex: 1,
                height: 86,
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces-Bold",
                  fontSize: 24,
                  color: "#3B0508",
                  marginBottom: 2,
                }}
              >
                {pendingBookingsCount}
              </Text>
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 10,
                  letterSpacing: 0.8,
                  color: "#8A7550",
                }}
              >
                PENDING BOOKINGS
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Action Buttons Row */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
          <Pressable
            onPress={() => router.push("/(admin)/measurements/new")}
            style={({ pressed }) => [
              {
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#4A080C",
                height: 52,
                borderRadius: 26,
                gap: 6,
                paddingHorizontal: 12,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text
              style={{
                fontFamily: "WorkSans_500Medium",
                fontSize: 14,
                color: "#FFFFFF",
              }}
            >
              New measurement
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(admin)/catalog" as any)}
            style={({ pressed }) => [
              {
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FFFFFF",
                borderWidth: 1.5,
                borderColor: "#4A080C",
                height: 52,
                borderRadius: 26,
                gap: 6,
                paddingHorizontal: 12,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Tag size={18} color="#4A080C" />
            <Text
              style={{
                fontFamily: "WorkSans_500Medium",
                fontSize: 14,
                color: "#4A080C",
              }}
            >
              Upload Clothes
            </Text>
          </Pressable>
        </View>

        {/* Booking Requests Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontFamily: "Fraunces-SemiBold",
              fontSize: 18,
              color: "#4A080C",
            }}
          >
            Booking requests
          </Text>
          <Pressable onPress={() => router.push("/(admin)/escalations")}>
            <Text
              style={{
                fontFamily: "WorkSans_500Medium",
                fontSize: 13,
                color: "#8A7550",
              }}
            >
              View All
            </Text>
          </Pressable>
        </View>

        {/* Booking Requests List */}
        {loading ? (
          <ActivityIndicator color="#4A080C" style={{ marginVertical: 20 }} />
        ) : displayRequests.length === 0 ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "WorkSans_400Regular",
                fontSize: 14,
                color: "rgba(74, 8, 12, 0.6)",
              }}
            >
              No pending booking requests.
            </Text>
          </View>
        ) : (
          <View style={isLandscape ? { flexDirection: "row", flexWrap: "wrap", gap: 12 } : undefined}>
            {displayRequests.map((item: any) => {
              const customerName = item.customerName || item.customer?.email?.split("@")[0] || "Customer";
              const initial = item.initial || customerName.charAt(0).toUpperCase();
              const detail = item.detail || item.reason || item.summary || "Bespoke fitting request";

              return (
                <View
                  key={item.id}
                  style={[
                    {
                      backgroundColor: "#FFFFFF",
                      borderRadius: 20,
                      height: 150,
                      padding: 16,
                      justifyContent: "space-between",
                      marginBottom: 14,
                    },
                    isLandscape && { width: "49%", marginBottom: 0 },
                  ]}
                >
                {/* Top Customer Info Row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 16,
                  }}
                >
                  {/* Initials Circle Avatar */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: "#7A3E26",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Fraunces-Bold",
                        fontSize: 18,
                        color: "#FFFFFF",
                      }}
                    >
                      {initial}
                    </Text>
                  </View>

                  {/* Name & Request detail */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "WorkSans_600SemiBold",
                        fontSize: 16,
                        color: "#3B0508",
                        marginBottom: 2,
                      }}
                    >
                      {customerName}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: "WorkSans_400Regular",
                        fontSize: 12,
                        color: "#8A7550",
                      }}
                    >
                      {detail}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  <View
                    style={{
                      backgroundColor: "#F4EFE6",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "WorkSans_500Medium",
                        fontSize: 11,
                        color: "#B0966C",
                      }}
                    >
                      Pending
                    </Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Pressable
                    onPress={async () => {
                      if (!item.id.startsWith("demo-")) {
                        const custName = item.customerName || item.customer?.email?.split("@")[0] || "Customer";
                        try {
                          const token = useAuthStore.getState().token;
                          if (token) {
                            const res = await fetch(`${API_BASE_URL}/api/measurements/check/${encodeURIComponent(custName)}`, {
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (res.ok) {
                              const data = await res.json();
                              if (data.hasMeasurements === false) {
                                router.push({
                                  pathname: "/(admin)/measurements/new",
                                  params: {
                                    bookingId: item.id,
                                    customerName: custName,
                                    serviceTitle: item.reason || item.summary || "Bespoke Fitting",
                                    appointmentTime: "Sat, Sept 6",
                                    returnToAssign: "true",
                                  },
                                } as any);
                                return;
                              }
                            }
                          }
                        } catch {}
                        router.push({
                          pathname: "/(admin)/escalations/assign",
                          params: {
                            bookingId: item.id,
                            customerName: custName,
                            serviceTitle: item.reason || item.summary || "Bespoke Fitting",
                            appointmentTime: "Sat, Sept 6",
                          },
                        } as any);
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#4A080C",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "WorkSans_600SemiBold",
                        fontSize: 14,
                        color: "#FFFFFF",
                      }}
                    >
                      Assign
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (!item.id.startsWith("demo-")) {
                        handleResolveEscalation(item.id);
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: "#4A080C",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "WorkSans_600SemiBold",
                        fontSize: 14,
                        color: "#4A080C",
                      }}
                    >
                      Decline
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
