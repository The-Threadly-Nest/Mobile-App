import React, { useState } from "react";
import { View, ScrollView, Pressable, Text, ActivityIndicator, RefreshControl, Modal, TextInput, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Plus, Trash2, Calendar, Clock, X } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { APP_DATA_CACHE_TTL_MS, useAppDataStore } from "@/stores/useAppDataStore";
import { adminApi, ordersApi, escalationsApi, measurementsApi, slotsApi, type AdminDashboardSummary } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { isBookingPending, isOrderWorkActive, isPaymentPaid } from "@/shared/domain/statuses";
import { formatCurrency } from "@/shared/utils/formatters";

interface EscalationItem {
  id: string;
  summary?: string;
  reason?: string;
  resolved: boolean;
  createdAt: string;
  customerId?: string;
  customerName?: string;
  customer?: { id: string; email: string };
  bookingStatus?: string;
  status?: string;
}

export default function AdminDashboard() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert, showConfirm } = useAppAlert();

  const storeName = useAuthStore((s) => s.name);
  const storeEmail = useAuthStore((s) => s.email);
  const storeRole = useAuthStore((s) => s.role);
  const storedShopName = useAuthStore((s) => s.shopName);
  const setStoredShopName = useAuthStore((s) => s.setShopName);

  const cachedOrders = useAppDataStore((s) => s.orders);
  const cachedEscalations = useAppDataStore((s) => s.escalations);
  const cachedProfile = useAppDataStore((s) => s.profile);
  const cachedSummary = useAppDataStore((s) => s.dashboardSummary);
  const cacheOwnerKey = useAppDataStore((s) => s.cacheOwnerKey);
  const cacheUpdatedAt = useAppDataStore((s) => s.lastSyncedAt);
  const setCachedOrders = useAppDataStore((s) => s.setOrders);
  const setCachedEscalations = useAppDataStore((s) => s.setEscalations);
  const setCachedProfile = useAppDataStore((s) => s.setProfile);
  const setCachedSummary = useAppDataStore((s) => s.setDashboardSummary);
  const activateCache = useAppDataStore((s) => s.activateCache);

  const expectedCacheOwner = storeEmail && storeRole
    ? `${storeRole}:${storeEmail.trim().toLowerCase()}`
    : null;
  const cacheIsFresh = Boolean(
    expectedCacheOwner &&
      cacheOwnerKey === expectedCacheOwner &&
      cacheUpdatedAt &&
      Date.now() - cacheUpdatedAt <= APP_DATA_CACHE_TTL_MS
  );

  const [shopName, setShopName] = useState(
    (cacheIsFresh ? cachedProfile?.shopName : null) || storedShopName || ""
  );

  // Seed states directly from persistent device storage — instant 0-spinner load!
  const [orders, setOrders] = useState<any[]>(cacheIsFresh ? cachedOrders : []);
  const [escalations, setEscalations] = useState<EscalationItem[]>(cacheIsFresh ? cachedEscalations : []);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(cacheIsFresh ? cachedSummary : null);
  const [assignLoadingId, setAssignLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    !cacheIsFresh || (cachedOrders.length === 0 && cachedEscalations.length === 0)
  );
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    if (expectedCacheOwner) activateCache(expectedCacheOwner);
  }, [activateCache, expectedCacheOwner]);

  React.useEffect(() => {
    if (cacheIsFresh && orders.length === 0 && cachedOrders.length > 0) {
      setOrders(cachedOrders);
      setLoading(false);
    }
    if (cacheIsFresh && escalations.length === 0 && cachedEscalations.length > 0) {
      setEscalations(cachedEscalations);
      setLoading(false);
    }
    if (cacheIsFresh && cachedProfile?.shopName && !shopName) setShopName(cachedProfile.shopName);
  }, [cacheIsFresh, cachedEscalations, cachedOrders, cachedProfile, escalations.length, orders.length, shopName]);



  const fetchData = async () => {
    // Only show full-screen spinner if local device cache is completely empty
    if (orders.length === 0 && escalations.length === 0) {
      setLoading(true);
    }
    try {
      const [profileRes, summaryRes, ordersRes, escalationsRes] = await Promise.allSettled([
        adminApi.getProfile(),
        adminApi.getDashboardSummary(),
        ordersApi.getOrders(),
        escalationsApi.getEscalations(),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
        const house = profileRes.value.fashionHouse;
        setCachedProfile(house);
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
        setCachedOrders(ordersRes.value);
      }

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
        setCachedSummary(summaryRes.value);
      }

      if (escalationsRes.status === "fulfilled" && Array.isArray(escalationsRes.value)) {
        setEscalations(escalationsRes.value);
        setCachedEscalations(escalationsRes.value);
      }
    } catch (err) {
      console.warn("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshDashboardSummary = async () => {
    try {
      const latestSummary = await adminApi.getDashboardSummary();
      setSummary(latestSummary);
      setCachedSummary(latestSummary);
    } catch (err) {
      // Keep the last successful figures during a temporary network failure.
      console.warn("Failed to refresh dashboard summary", err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // Immediate fetch on focus
      fetchData();

      // Only refresh the three small dashboard figures in the background.
      // Lists and profile data refresh on focus or pull-to-refresh.
      const interval = setInterval(refreshDashboardSummary, 30_000);

      // Cleanup: stop polling when admin navigates away
      return () => clearInterval(interval);
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDeclineBooking = (id: string, customerName?: string) => {
    showConfirm(
      "Decline Booking",
      `Are you sure you want to decline the booking request for ${customerName || "this customer"}?`,
      {
        confirmLabel: "Decline",
        cancelLabel: "Cancel",
        onConfirm: async () => {
          try {
            await escalationsApi.declineBooking(id);
            // Mark locally as resolved so it drops off the pending list immediately
            setEscalations((prev) =>
              prev.map((item) =>
                item.id === id
                  ? { ...item, resolved: true, bookingStatus: "declined" }
                  : item
              )
            );
            showAlert("Booking Declined", `The booking request for ${customerName || "this customer"} has been declined.`);
          } catch (err) {
            console.error("Failed to decline booking:", err);
            showAlert("Error", "Could not decline the booking. Please try again.");
          }
        },
      }
    );
  };

  // Smart Fallback filtering & deduplication
  const realOrders = orders.filter((o) => !o.id?.startsWith("mock-"));
  const realEscalations = escalations.filter((e) => !e.id?.startsWith("mock-"));

  const effectiveOrders = realOrders.length > 0 ? realOrders : orders;
  const effectiveEscalations = realEscalations.length > 0 ? realEscalations : escalations;

  // Active Orders count = orders in progress (not completed, delivered, ready_for_pickup, or cancelled)
  const pageActiveOrdersCount = effectiveOrders.filter((o) => isOrderWorkActive(o.status)).length;

  // Page-only fallback: payment and fulfilment are separate states.
  const paidOrders = realOrders.filter(
    (o) =>
      o.isPaid === true ||
      isPaymentPaid(o.paymentStatus || o.invoice?.paymentStatus || o.invoiceStatus)
  );

  const pageRevenue = paidOrders.reduce((sum, o) => sum + (o.invoice?.total || o.price || 0), 0);

  // Deduplicate pending escalations/bookings by ID or customer reference
  const uniquePendingEscalations = new Map<string, any>();
  effectiveEscalations.forEach((e) => {
    if (!e.resolved && (isBookingPending(e.bookingStatus) || !e.bookingStatus)) {
      const key = e.id || e.customerId || e.customerName || "esc";
      if (!uniquePendingEscalations.has(key)) {
        uniquePendingEscalations.set(key, e);
      }
    }
  });
  const pendingEscalations = Array.from(uniquePendingEscalations.values());
  const activeOrdersCount = summary?.activeOrdersCount ?? pageActiveOrdersCount;
  const pendingBookingsCount = summary?.pendingBookingsCount ?? pendingEscalations.length;
  const totalRevenue = summary?.revenueThisMonth ?? pageRevenue;

  // Declined bookings count — bookingStatus is set by the server
  const declinedBookingsCount = effectiveEscalations.filter(
    (e) => e.bookingStatus === "declined"
  ).length;

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 40 },
          isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#453332" />}
      >
        {/* Subtitle Badge */}
        <Text
          style={{
            fontFamily: "InstrumentSans-Medium",
            fontSize: 13,
            color: "#453332",
            marginBottom: 4,
          }}
        >
          {shopNameDisplay} · Admin
        </Text>

        {/* Serif Greeting */}
        <View style={{ marginBottom: 20, justifyContent: "center" }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              fontFamily: "HedvigLettersSerif-Regular",
              fontSize: 26,
              color: "#3B0508",
              lineHeight: 34,
            }}
          >
            {getGreeting()}, {adminFirstName}
          </Text>
        </View>

        {/* Top Metrics Row: Side-by-side in landscape, stacked in portrait */}
        <View style={isLandscape ? { flexDirection: "row", gap: 12, marginBottom: 20 } : { marginBottom: 24 }}>
          {/* Monthly Revenue Banner */}
          <View
            style={[
              {
                backgroundColor: "#453332",
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
                fontFamily: "HedvigLettersSerif-Regular",
                fontSize: 28,
                color: "#FFFFFF",
                marginBottom: 4,
              }}
            >
              {formatCurrency(totalRevenue)}
            </Text>
            <Text
              style={{
                fontFamily: "InstrumentSans-SemiBold",
                fontSize: 11,
                letterSpacing: 1.2,
                color: "rgba(244, 239, 230, 0.8)",
              }}
            >
              REVENUE THIS MONTH
            </Text>
          </View>

          {/* Side-by-Side Stat Cards — Row 1: Active + Pending */}
          <View style={[{ flexDirection: "row", gap: 12 }, isLandscape && { flex: 1 }]}>
            <Pressable
              onPress={() => router.push("/(admin)/orders" as any)}
              style={({ pressed }) => ({
                flex: 1,
                height: 86,
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "HedvigLettersSerif-Regular",
                  fontSize: 24,
                  color: "#3B0508",
                  marginBottom: 2,
                }}
              >
                {activeOrdersCount}
              </Text>
              <Text
                style={{
                  fontFamily: "InstrumentSans-SemiBold",
                  fontSize: 10,
                  letterSpacing: 0.8,
                  color: "#8A7550",
                }}
              >
                ACTIVE ORDERS
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/(admin)/escalations" as any)}
              style={({ pressed }) => ({
                flex: 1,
                height: 86,
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "HedvigLettersSerif-Regular",
                  fontSize: 24,
                  color: "#3B0508",
                  marginBottom: 2,
                }}
              >
                {pendingBookingsCount}
              </Text>
              <Text
                style={{
                  fontFamily: "InstrumentSans-SemiBold",
                  fontSize: 10,
                  letterSpacing: 0.8,
                  color: "#8A7550",
                }}
              >
                PENDING BOOKINGS
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Action Button Row — Take Measurement */}
        <View style={{ marginBottom: 24, marginTop: 12 }}>
          <Pressable
            onPress={() => router.push("/(admin)/measurements/new")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#453332",
                height: 52,
                borderRadius: 26,
                gap: 8,
                paddingHorizontal: 16,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Plus size={20} color="#FFFFFF" />
            <Text
              style={{
                fontFamily: "InstrumentSans-SemiBold",
                fontSize: 15,
                color: "#FFFFFF",
              }}
            >
              Take Measurement
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
              fontFamily: "HedvigLettersSerif-Regular",
              fontSize: 18,
              color: "#453332",
            }}
          >
            Booking requests
          </Text>
          <Pressable onPress={() => router.push("/(admin)/escalations")}>
            <Text
              style={{
                fontFamily: "InstrumentSans-Medium",
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
          <ActivityIndicator color="#453332" style={{ marginVertical: 20 }} />
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
                fontFamily: "InstrumentSans-Regular",
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
                        fontFamily: "HedvigLettersSerif-Regular",
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
                        fontFamily: "InstrumentSans-SemiBold",
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
                        fontFamily: "InstrumentSans-Regular",
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
                        fontFamily: "InstrumentSans-Medium",
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
                    disabled={assignLoadingId === item.id}
                    onPress={async () => {
                      if (!item.id.startsWith("demo-")) {
                        const custName = item.customerName || item.customer?.email?.split("@")[0] || "Customer";
                        setAssignLoadingId(item.id);
                        try {
                          const data = await measurementsApi.checkCustomer(custName);
                          if (data.hasMeasurements === false) {
                            showConfirm(
                              "Measurement Required",
                              `No measurements found for ${custName}. Please record measurement details before assigning staff.`,
                              {
                                confirmLabel: "Add Measurement",
                                onConfirm: () => {
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
                                },
                              }
                            );
                            return;
                          }
                        } catch (err: any) {
                          showAlert("Unable to Check Measurements", err?.message || "Please try again before assigning staff.");
                          return;
                        } finally {
                          setAssignLoadingId(null);
                        }
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
                        backgroundColor: "#453332",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed || assignLoadingId === item.id ? 0.7 : 1,
                      },
                    ]}
                  >
                    {assignLoadingId === item.id ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        style={{
                          fontFamily: "InstrumentSans-SemiBold",
                          fontSize: 14,
                          color: "#FFFFFF",
                        }}
                      >
                        Assign
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      if (!item.id.startsWith("demo-")) {
                        handleDeclineBooking(item.id, customerName);
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: "#453332",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontFamily: "InstrumentSans-SemiBold",
                        fontSize: 14,
                        color: "#453332",
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
