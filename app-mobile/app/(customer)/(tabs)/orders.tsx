import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useOrdersStore, OrderItem } from "@/stores/useOrdersStore";
import { apiFetchCollectionPage } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import CachedImage from "@/shared/components/CachedImage";
import { isCustomerOrderActive, isOrderCancelled, isOrderDelivered } from "@/shared/domain/statuses";

function getRealGarmentImage(order: OrderItem): string {
  return order.imageUrl || "";
}

export default function CustomerOrdersScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "declined">("active");
  const storeOrders = useOrdersStore((s) => s.orders);
  const setStoreOrders = useOrdersStore((s) => s.setOrders);

  useEffect(() => {
    let mounted = true;
    async function fetchCustomerOrders() {
      try {
        const result = await apiFetchCollectionPage<OrderItem>(
          "/api/orders/my-orders?page=1&limit=50",
          { silent: true }
        ).catch(() => null);
        if (mounted && result) {
          setStoreOrders(result.items);
          setNextPage(result.nextPage);
        }
      } catch (err) {
        console.log("Could not fetch server orders:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchCustomerOrders();
    return () => {
      mounted = false;
    };
  }, []);

  const loadMoreOrders = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await apiFetchCollectionPage<OrderItem>(
        `/api/orders/my-orders?page=${nextPage}&limit=50`,
        { silent: true }
      );
      const byId = new Map(storeOrders.map((order) => [order.id, order]));
      result.items.forEach((order) => byId.set(order.id, order));
      setStoreOrders(Array.from(byId.values()));
      setNextPage(result.nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  // Filter out mock data when real server data exists or while loading
  const realOrders = storeOrders.filter((o) => !o.id.startsWith("mock-"));
  const effectiveOrders = realOrders;

  const activeOrders = effectiveOrders.filter((o) => isCustomerOrderActive(o.rawStatus || o.status));
  const completedOrders = effectiveOrders.filter((o) => isOrderDelivered(o.rawStatus || o.status));
  const declinedOrders = effectiveOrders.filter((o) => isOrderCancelled(o.rawStatus || o.status));

  const displayedOrders =
    activeTab === "active"
      ? activeOrders
      : activeTab === "completed"
        ? completedOrders
        : declinedOrders;

  return (
    <SafeAreaView className="flex-1 bg-[#FFFFFF]" edges={["top"]}>
      <ScrollView
        className="flex-1 px-4"
        style={{ paddingTop: 36 }}
        contentContainerStyle={[
          { paddingBottom: 64, gap: 12 },
          isLandscape && { maxWidth: 840, alignSelf: "center", width: "100%", paddingHorizontal: 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={[{ width: "100%", maxWidth: 376, alignSelf: "center", marginBottom: 4 }, isLandscape && { maxWidth: 600 }]}>
          <Text style={{ fontFamily: "HedvigLettersSerif-Regular", fontSize: 24, color: "#000000" }}>
            My Orders
          </Text>
        </View>

        {/* Tab Filter Pills */}
        <View style={[{ width: "100%", maxWidth: 376, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }, isLandscape && { maxWidth: 600 }]}>
          <Pressable
            onPress={() => setActiveTab("active")}
            className={`flex-1 h-[44px] rounded-full items-center justify-center ${activeTab === "active" ? "bg-[#453332]" : "bg-[#E2E2E2]"
              }`}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text
              className={`font-body-semibold text-[13px] ${activeTab === "active" ? "text-white" : "text-[#404040]"
                }`}
            >
              Active ({activeOrders.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("completed")}
            className={`flex-1 h-[44px] rounded-full items-center justify-center ${activeTab === "completed" ? "bg-[#453332]" : "bg-[#E2E2E2]"
              }`}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text
              className={`font-body-semibold text-[13px] ${activeTab === "completed" ? "text-white" : "text-[#404040]"
                }`}
            >
              Completed ({completedOrders.length})
            </Text>
          </Pressable>

          {declinedOrders.length > 0 && (
            <Pressable
              onPress={() => setActiveTab("declined")}
              className={`flex-1 h-[44px] rounded-full items-center justify-center ${activeTab === "declined" ? "bg-[#453332]" : "bg-[#E2E2E2]"
                }`}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text
                className={`font-body-semibold text-[13px] ${activeTab === "declined" ? "text-white" : "text-[#404040]"
                  }`}
              >
                Declined ({declinedOrders.length})
              </Text>
            </Pressable>
          )}
        </View>

        {/* Orders List */}
        {loading && displayedOrders.length === 0 ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#453332" />
          </View>
        ) : displayedOrders.length === 0 ? (
          <View className="py-12 items-center justify-center">
            <Text className="font-body text-[15px] text-[#646464]">
              No {activeTab} orders found.
            </Text>
          </View>
        ) : (
          <View style={isLandscape ? { flexDirection: "row", flexWrap: "wrap", gap: 12 } : { gap: 12 }}>
            {displayedOrders.map((order) => {
              const formattedNum = generateOrderNumber(order.orderId || order.bookingId || order.id);
              const isDeclined = isOrderCancelled(order.rawStatus || order.status);
              const isCancelled = isDeclined;

              return (
                <Pressable
                  key={order.id}
                  onPress={() =>
                    router.push({
                      pathname: `/(customer)/orders/${order.id}`,
                      params: {
                        atelierName: order.atelierName,
                        garmentType: order.garmentType,
                        orderNumber: formattedNum,
                        estimatedReady: order.estimatedReady,
                        progressPercent: String(order.progressPercent),
                        imageUrl: order.imageUrl,
                        rawStatus: isCancelled ? "cancelled" : (isDeclined ? "declined" : order.status),
                      },
                    })
                  }
                  style={({ pressed }) => [
                    {
                      width: "100%",
                      maxWidth: 376,
                      height: 100,
                      alignSelf: "center",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 16,
                      backgroundColor: isDeclined ? "#FFF5F5" : "#FFFFFF",
                      borderRadius: 20,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: isDeclined ? "#FECDD3" : (isCancelled ? "#E5DFD5" : "#F0EBE1"),
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                    isLandscape && { width: "49%", maxWidth: undefined },
                  ]}
                >
                  {/* Thumbnail Image */}
                  <CachedImage
                    source={{ uri: getRealGarmentImage(order) }}
                    style={{ width: 80, height: 80, borderRadius: 14 }}
                    contentFit="cover"
                    contentPosition="top center"
                  />

                  {/* Right Details */}
                  <View className="flex-1 h-20 justify-between py-0.5">
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text className="font-body-bold text-[15px] text-black" numberOfLines={1}>
                          {order.atelierName}
                        </Text>
                        {isDeclined ? (
                          <View style={{ backgroundColor: "#FDEAEA", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#DC2626" }}>
                              Declined
                            </Text>
                          </View>
                        ) : isCancelled ? (
                          <View style={{ backgroundColor: "#F5EFE6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: "#E5DFD5" }}>
                            <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 10, color: "#453332" }}>
                              Cancelled
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      <Text className="font-body text-[12px] text-[#8A7550] mt-0.5" numberOfLines={1}>
                        {order.garmentType} · Order: {formattedNum}
                      </Text>
                    </View>

                    {isDeclined ? (
                      <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 11.5, color: "#DC2626" }}>
                        Appointment request declined
                      </Text>
                    ) : isCancelled ? (
                      <Text style={{ fontFamily: "InstrumentSans-Medium", fontSize: 11.5, color: "#5C4A32" }}>
                        Order cancelled by you
                      </Text>
                    ) : (
                      <View>
                        {/* Progress Bar */}
                        <View className="w-full max-w-[200px] h-[4px] bg-[#E0E0E0] rounded-full overflow-hidden mb-1.5">
                          <View
                            className="h-full bg-[#C4A763] rounded-full"
                            style={{ width: `${order.progressPercent}%` }}
                          />
                        </View>

                        <Text className="font-body text-[12px] text-[#646464]">
                          Estimated ready: {order.estimatedReady}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
            {nextPage ? (
              <Pressable
                onPress={() => void loadMoreOrders()}
                disabled={loadingMore}
                style={{ alignSelf: "center", paddingVertical: 12, paddingHorizontal: 20 }}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#453332" />
                ) : (
                  <Text style={{ color: "#453332", fontFamily: "InstrumentSans-SemiBold" }}>Load more orders</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
