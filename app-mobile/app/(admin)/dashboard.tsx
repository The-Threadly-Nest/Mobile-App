import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
  RefreshControl,
  Image,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";
import { router, useFocusEffect } from "expo-router";
import { Menu, ChevronDown, Star, Plus, MessageSquare } from "lucide-react-native";
import Svg, { Path, Defs, LinearGradient, Stop, Circle as SvgCircle } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { APP_DATA_CACHE_TTL_MS, useAppDataStore } from "@/stores/useAppDataStore";
import {
  adminApi,
  ordersApi,
  escalationsApi,
  measurementsApi,
  apiFetch,
  apiFetchCollectionPage,
  type AdminDashboardSummary,
} from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { isBookingPending, isOrderWorkActive, isPaymentPaid } from "@/shared/domain/statuses";
import { formatCurrency } from "@/shared/utils/formatters";
import CachedImage from "@/shared/components/CachedImage";

interface CatalogItem {
  id: string;
  name: string;
  priceFrom: number | null;
  imageUrl: string;
}

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

  const expectedCacheOwner =
    storeEmail && storeRole ? `${storeRole}:${storeEmail.trim().toLowerCase()}` : null;
  const cacheIsFresh = Boolean(
    expectedCacheOwner &&
      cacheOwnerKey === expectedCacheOwner &&
      cacheUpdatedAt &&
      Date.now() - cacheUpdatedAt <= APP_DATA_CACHE_TTL_MS
  );

  const [shopName, setShopName] = useState(
    (cacheIsFresh ? cachedProfile?.shopName : null) || storedShopName || ""
  );
  const [orders, setOrders] = useState<any[]>(cacheIsFresh ? cachedOrders : []);
  const [escalations, setEscalations] = useState<EscalationItem[]>(cacheIsFresh ? cachedEscalations : []);
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(cacheIsFresh ? cachedSummary : null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string>("");
  const [assignLoadingId, setAssignLoadingId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(
    !cacheIsFresh || (cachedOrders.length === 0 && cachedEscalations.length === 0)
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (expectedCacheOwner) activateCache(expectedCacheOwner);
  }, [activateCache, expectedCacheOwner]);

  useEffect(() => {
    if (cacheIsFresh && orders.length === 0 && cachedOrders.length > 0) {
      setOrders(cachedOrders);
      setLoading(false);
    }
    if (cacheIsFresh && escalations.length === 0 && cachedEscalations.length > 0) {
      setEscalations(cachedEscalations);
      setLoading(false);
    }
    if (cacheIsFresh && cachedProfile?.shopName && !shopName) setShopName(cachedProfile.shopName);
    if (cachedProfile?.brandLogoUrl) setBrandLogoUrl(cachedProfile.brandLogoUrl);
  }, [cacheIsFresh, cachedEscalations, cachedOrders, cachedProfile, escalations.length, orders.length, shopName]);

  const fetchData = async () => {
    if (orders.length === 0 && escalations.length === 0) {
      setLoading(true);
    }
    try {
      const [profileRes, summaryRes, ordersRes, escalationsRes, catalogRes] = await Promise.allSettled([
        adminApi.getProfile(),
        adminApi.getDashboardSummary(),
        ordersApi.getOrders(),
        escalationsApi.getEscalations(),
        apiFetchCollectionPage<CatalogItem>("/api/catalog?page=1&limit=10", { silent: true }),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
        const house = profileRes.value.fashionHouse;
        setCachedProfile(house);
        if (house.admin?.name) useAuthStore.getState().setName(house.admin.name);
        if (house.shopName || house.name) {
          const name = house.shopName || house.name;
          setShopName(name);
          setStoredShopName(name);
        }
        if (house.brandLogoUrl) setBrandLogoUrl(house.brandLogoUrl);
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

      if (catalogRes.status === "fulfilled" && Array.isArray(catalogRes.value.items)) {
        setCatalogItems(catalogRes.value.items);
      }

      // Fetch unread messages count for header notification badge
      try {
        const threads = await apiFetch<any[]>("/api/direct-messages/threads", { silent: true });
        if (Array.isArray(threads)) {
          const total = threads.reduce((acc: number, t: any) => acc + (t.unreadCount || 0), 0);
          setUnreadCount(total);
        }
      } catch {}
    } catch (err) {
      console.warn("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      const interval = setInterval(async () => {
        try {
          const latestSummary = await adminApi.getDashboardSummary();
          setSummary(latestSummary);
          setCachedSummary(latestSummary);
        } catch {}
      }, 30_000);
      return () => clearInterval(interval);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
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
            setEscalations((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, resolved: true, bookingStatus: "declined" } : item
              )
            );
            showAlert("Booking Declined", `The booking request for ${customerName || "this customer"} has been declined.`);
          } catch {
            showAlert("Error", "Could not decline the booking. Please try again.");
          }
        },
      }
    );
  };

  const realOrders = orders.filter((o) => !o.id?.startsWith("mock-"));
  const realEscalations = escalations.filter((e) => !e.id?.startsWith("mock-"));
  const effectiveOrders = realOrders;
  const effectiveEscalations = realEscalations;

  const pageActiveOrdersCount = effectiveOrders.filter((o) => isOrderWorkActive(o.status)).length;
  const paidOrders = realOrders.filter(
    (o) => o.isPaid === true || isPaymentPaid(o.paymentStatus || o.invoice?.paymentStatus || o.invoiceStatus)
  );
  const pageRevenue = paidOrders.reduce((sum, o) => sum + (o.invoice?.total || o.price || 0), 0);

  const uniquePendingEscalations = new Map<string, any>();
  effectiveEscalations.forEach((e) => {
    if (!e.resolved && (isBookingPending(e.bookingStatus) || !e.bookingStatus)) {
      const key = e.id || e.customerId || e.customerName || "esc";
      if (!uniquePendingEscalations.has(key)) uniquePendingEscalations.set(key, e);
    }
  });
  const pendingEscalations = Array.from(uniquePendingEscalations.values());

  const activeOrdersCount = summary?.activeOrdersCount ?? pageActiveOrdersCount;
  const pendingBookingsCount = summary?.pendingBookingsCount ?? pendingEscalations.length;
  const totalRevenue = summary?.revenueThisMonth;

  const shopNameDisplay = shopName || storedShopName || "Your fashion house";
  const displayRequests = pendingEscalations.slice(0, 3);

  const displayedProducts = catalogItems;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F8F9" }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          { paddingHorizontal: 20, paddingTop: SCREEN_TOP_SPACING, paddingBottom: 110 },
          isLandscape && { maxWidth: 760, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F96951" />}
      >
        {/* ─── 1. Header (Location & Brand on Left, Message Icon on Right) ─── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          {/* Left: Location & Brand Name */}
          <Pressable
            onPress={() => router.push("/(admin)/settings" as any)}
            style={{ alignItems: "flex-start" }}
          >
            <Text
              style={{
                fontFamily: "InstrumentSans-Bold",
                fontSize: 10,
                color: "#F96951",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Location
            </Text>
            <Text
              style={{
                fontFamily: "InstrumentSans-SemiBold",
                fontSize: 16,
                color: "#32343E",
              }}
              numberOfLines={1}
            >
              {shopNameDisplay}
            </Text>
          </Pressable>

          {/* Right: Message & Notification Icon with Badge */}
          <Pressable
            onPress={() => router.push("/(admin)/messages" as any)}
            accessibilityRole="button"
            accessibilityLabel="Messages and notifications"
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              elevation: 2,
              shadowColor: "#000000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MessageSquare size={19} color="#32343E" strokeWidth={2} />
            {unreadCount > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: "#F96951",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ fontFamily: "InstrumentSans-Bold", fontSize: 9, color: "#FFFFFF" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* ─── 2. Running Orders & Order Request (Figma Stats) ─── */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          {/* Running Orders Card */}
          <Pressable
            onPress={() => router.push("/(admin)/orders")}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              paddingVertical: 18,
              paddingHorizontal: 16,
              elevation: 2,
              shadowColor: "#000000",
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "InstrumentSans-Bold",
                fontSize: 34,
                color: "#32343E",
                marginBottom: 4,
              }}
            >
              {String(activeOrdersCount).padStart(2, "0")}
            </Text>
            <Text
              style={{
                fontFamily: "InstrumentSans-SemiBold",
                fontSize: 10,
                letterSpacing: 0.8,
                color: "#838799",
                textTransform: "uppercase",
              }}
            >
              Running Orders
            </Text>
          </Pressable>

          {/* Order Request Card */}
          <Pressable
            onPress={() => router.push("/(admin)/escalations")}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              paddingVertical: 18,
              paddingHorizontal: 16,
              elevation: 2,
              shadowColor: "#000000",
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "InstrumentSans-Bold",
                fontSize: 34,
                color: "#32343E",
                marginBottom: 4,
              }}
            >
              {String(pendingBookingsCount).padStart(2, "0")}
            </Text>
            <Text
              style={{
                fontFamily: "InstrumentSans-SemiBold",
                fontSize: 10,
                letterSpacing: 0.8,
                color: "#838799",
                textTransform: "uppercase",
              }}
            >
              Order Request
            </Text>
          </Pressable>
        </View>

        {/* ─── 3. Total Revenue Card with Curve Chart (Figma Spec) ─── */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
            elevation: 2,
            shadowColor: "#000000",
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          {/* Revenue Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 13, color: "#32343E" }}>
              Total Revenue
            </Text>

            {/* Daily Filter Pill */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: 1,
                borderColor: "#E8EAED",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontFamily: "InstrumentSans-Regular", fontSize: 11, color: "#453332" }}>This month</Text>
              <ChevronDown size={11} color="#453332" />
            </View>

            {/* See Details Link */}
            <Pressable onPress={() => router.push("/(admin)/invoices")}>
              <Text
                style={{
                  fontFamily: "InstrumentSans-Regular",
                  fontSize: 12,
                  color: "#F96951",
                  textDecorationLine: "underline",
                }}
              >
                See Details
              </Text>
            </Pressable>
          </View>

          {/* Revenue Value */}
          <Text
            style={{
              fontFamily: "InstrumentSans-Bold",
              fontSize: 22,
              color: "#32343E",
              marginBottom: 10,
            }}
          >
            {totalRevenue == null ? "Unavailable" : formatCurrency(totalRevenue)}
          </Text>

          <Text style={{ fontFamily: "InstrumentSans-Regular", color: "#746765", fontSize: 12, marginTop: 12 }}>Revenue from paid invoices this month.</Text>
        </View>

        {/* ─── 5. Pending Booking Requests (Preserved Admin Actions) ─── */}
        {displayRequests.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontFamily: "HedvigLettersSerif-Regular", fontSize: 17, color: "#32343E" }}>
                Booking requests
              </Text>
              <Pressable onPress={() => router.push("/(admin)/escalations")}>
                <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 12, color: "#F96951" }}>
                  View All ({pendingEscalations.length})
                </Text>
              </Pressable>
            </View>

            {displayRequests.map((item: any) => {
              const customerName = item.customerName || item.customer?.email?.split("@")[0] || "Customer";
              const detail = item.reason || item.summary || "Bespoke fitting request";

              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    elevation: 1,
                    shadowColor: "#000000",
                    shadowOpacity: 0.03,
                    shadowRadius: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 14, color: "#32343E" }}>
                        {customerName}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: "InstrumentSans-Regular", fontSize: 12, color: "#8A7550" }}>
                        {detail}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: "#F4EFE6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                      <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 10, color: "#B0966C" }}>Pending</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      disabled={assignLoadingId === item.id}
                      onPress={async () => {
                        setAssignLoadingId(item.id);
                        try {
                          const check = await measurementsApi.checkCustomer(customerName);
                          if (!check?.hasMeasurements) {
                            showConfirm(
                              "Measurement Required",
                              `No measurements found for ${customerName}. Record measurements before assigning?`,
                              {
                                confirmLabel: "Add Measurement",
                                onConfirm: () =>
                                  router.push({
                                    pathname: "/(admin)/measurements/new",
                                    params: { bookingId: item.id, customerName },
                                  } as any),
                              }
                            );
                            return;
                          }
                          router.push({
                            pathname: "/(admin)/escalations/assign",
                            params: { bookingId: item.id, customerName, serviceTitle: detail },
                          } as any);
                        } catch {
                          router.push({
                            pathname: "/(admin)/escalations/assign",
                            params: { bookingId: item.id, customerName, serviceTitle: detail },
                          } as any);
                        } finally {
                          setAssignLoadingId(null);
                        }
                      }}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "#453332",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {assignLoadingId === item.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#FFFFFF" }}>Assign</Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => handleDeclineBooking(item.id, customerName)}
                      style={{
                        flex: 1,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: "#453332",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 13, color: "#453332" }}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ─── 6. My Listed Items / Admin Products (Figma Spec) ─── */}
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "InstrumentSans-Bold",
                fontSize: 15,
                color: "#32343E",
              }}
            >
              My Listed Items
            </Text>
            <Pressable onPress={() => router.push("/(admin)/catalog")}>
              <Text
                style={{
                  fontFamily: "InstrumentSans-Regular",
                  fontSize: 12,
                  color: "#F96951",
                  textDecorationLine: "underline",
                }}
              >
                See All
              </Text>
            </Pressable>
          </View>

          {/* Product Items Horizontal Scroll / Cards */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {displayedProducts.map((prod) => (
              <Pressable
                key={prod.id}
                onPress={() => {
                  if (prod.id.startsWith("showcase-")) {
                    router.push("/(admin)/catalog/new");
                  } else {
                    router.push(`/(admin)/catalog/${prod.id}` as any);
                  }
                }}
                style={({ pressed }) => ({
                  width: 150,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  overflow: "hidden",
                  elevation: 2,
                  shadowColor: "#000000",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View style={{ width: "100%", height: 145, backgroundColor: "#EBE0D3" }}>
                  <CachedImage
                    source={{ uri: prod.imageUrl }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                </View>
                <View style={{ padding: 10 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: "InstrumentSans-SemiBold",
                      fontSize: 13,
                      color: "#32343E",
                      marginBottom: 2,
                    }}
                  >
                    {prod.name}
                  </Text>
                  {prod.priceFrom ? (
                    <Text
                      style={{
                        fontFamily: "InstrumentSans-Bold",
                        fontSize: 12,
                        color: "#F96951",
                      }}
                    >
                      {formatCurrency(prod.priceFrom)}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        fontFamily: "InstrumentSans-Regular",
                        fontSize: 11,
                        color: "#8A7550",
                      }}
                    >
                      Price on request
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}

            {/* Quick Action: Add New Item Card */}
            <Pressable
              onPress={() => router.push("/(admin)/catalog/new")}
              style={({ pressed }) => ({
                width: 130,
                height: 195,
                borderRadius: 18,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: "#D7CFCD",
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 12,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#F4EFE6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={20} color="#453332" />
              </View>
              <Text
                style={{
                  fontFamily: "InstrumentSans-SemiBold",
                  fontSize: 12,
                  color: "#453332",
                  textAlign: "center",
                }}
              >
                Add Item
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
