import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useOrdersStore, OrderItem } from "@/stores/useOrdersStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";
import CachedImage from "@/shared/components/CachedImage";

function getRealGarmentImage(order: OrderItem): string {
  if (order.imageUrl && !order.imageUrl.includes("unsplash.com/photo-1566174053879-31528523f8ae")) {
    return order.imageUrl;
  }
  const type = (order.garmentType || "").toLowerCase();
  if (type.includes("vintage") || type.includes("shirt")) {
    return "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&q=80";
  }
  if (type.includes("adire")) {
    return "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=500&q=80";
  }
  if (type.includes("2piece") || type.includes("2 piece") || type.includes("suit") || type.includes("agbada")) {
    return "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&q=80";
  }
  if (type.includes("kaftan")) {
    return "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&q=80";
  }
  return order.imageUrl || "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=500&q=80";
}

export default function CustomerOrdersScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed" | "declined">("active");
  const storeOrders = useOrdersStore((s) => s.orders);
  const setStoreOrders = useOrdersStore((s) => s.setOrders);

  useEffect(() => {
    let mounted = true;
    async function fetchCustomerOrders() {
      try {
        const fetched = await apiFetch<OrderItem[]>("/api/orders/my-orders", { silent: true }).catch(() => null);
        if (mounted && Array.isArray(fetched)) {
          setStoreOrders(fetched);
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

  // Filter out mock data when real server data exists or while loading
  const realOrders = storeOrders.filter((o) => !o.id.startsWith("mock-"));
  const effectiveOrders = realOrders.length > 0 ? realOrders : (loading ? [] : storeOrders);

  const activeOrders = effectiveOrders.filter((o) => o.status === "active");
  const completedOrders = effectiveOrders.filter((o) => o.status === "completed");
  const declinedOrders = effectiveOrders.filter((o) => o.status === "declined" || o.status === "cancelled");

  const displayedOrders =
    activeTab === "active"
      ? activeOrders
      : activeTab === "completed"
        ? completedOrders
        : declinedOrders;

  return (
    <SafeAreaView className="flex-1 bg-[#FBF7EF]" edges={["top"]}>
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
          <Text style={{ fontFamily: "Fraunces-SemiBold", fontSize: 24, color: "#000000" }}>
            My Orders
          </Text>
        </View>

        {/* Tab Filter Pills */}
        <View style={[{ width: "100%", maxWidth: 376, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }, isLandscape && { maxWidth: 600 }]}>
          <Pressable
            onPress={() => setActiveTab("active")}
            className={`flex-1 h-[44px] rounded-full items-center justify-center ${activeTab === "active" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
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
            className={`flex-1 h-[44px] rounded-full items-center justify-center ${activeTab === "completed" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
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
              className={`flex-1 h-[44px] rounded-full items-center justify-center ${activeTab === "declined" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
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
            <ActivityIndicator size="large" color="#4A080C" />
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
              const isDeclined = order.rawStatus === "declined" || order.status === "declined";
              const isCancelled = order.rawStatus === "cancelled" || order.status === "cancelled";

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
                            <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#DC2626" }}>
                              Declined
                            </Text>
                          </View>
                        ) : isCancelled ? (
                          <View style={{ backgroundColor: "#F5EFE6", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: "#E5DFD5" }}>
                            <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#4A080C" }}>
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
                      <Text style={{ fontFamily: "WorkSans_500Medium", fontSize: 11.5, color: "#DC2626" }}>
                        Appointment request declined
                      </Text>
                    ) : isCancelled ? (
                      <Text style={{ fontFamily: "WorkSans_500Medium", fontSize: 11.5, color: "#5C4A32" }}>
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
