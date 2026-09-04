import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, Pressable, Image, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useOrdersStore, OrderItem } from "@/stores/useOrdersStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { generateOrderNumber } from "@/shared/utils/orderUtils";

export default function CustomerOrdersScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [activeTab, setActiveTab] = useState<"active" | "completed" | "declined">("active");
  const storeOrders = useOrdersStore((s) => s.orders);
  const setStoreOrders = useOrdersStore((s) => s.setOrders);

  useEffect(() => {
    let mounted = true;
    async function fetchCustomerOrders() {
      try {
        const fetched = await apiFetch<OrderItem[]>("/api/orders/my-orders", { silent: true }).catch(() => []);
        if (mounted && Array.isArray(fetched) && fetched.length > 0) {
          setStoreOrders(fetched);
        }
      } catch (err) {
        console.log("Could not fetch server orders:", err);
      }
    }

    fetchCustomerOrders();
    return () => {
      mounted = false;
    };
  }, []);

  // Smart Fallback: If customer has real orders, show ONLY real orders (purging mock ones).
  const realOrders = storeOrders.filter((o) => !o.id.startsWith("mock-"));
  const effectiveOrders = realOrders.length > 0 ? realOrders : storeOrders;

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
        className="flex-1 px-4 pt-4"
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
            className={`flex-1 h-[44px] rounded-full items-center justify-center ${
              activeTab === "active" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
            }`}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text
              className={`font-body-semibold text-[13px] ${
                activeTab === "active" ? "text-white" : "text-[#404040]"
              }`}
            >
              Active ({activeOrders.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("completed")}
            className={`flex-1 h-[44px] rounded-full items-center justify-center ${
              activeTab === "completed" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
            }`}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text
              className={`font-body-semibold text-[13px] ${
                activeTab === "completed" ? "text-white" : "text-[#404040]"
              }`}
            >
              Completed ({completedOrders.length})
            </Text>
          </Pressable>

          {declinedOrders.length > 0 && (
            <Pressable
              onPress={() => setActiveTab("declined")}
              className={`flex-1 h-[44px] rounded-full items-center justify-center ${
                activeTab === "declined" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
              }`}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <Text
                className={`font-body-semibold text-[13px] ${
                  activeTab === "declined" ? "text-white" : "text-[#404040]"
                }`}
              >
                Declined ({declinedOrders.length})
              </Text>
            </Pressable>
          )}
        </View>

        {/* Orders List */}
        {displayedOrders.length === 0 ? (
          <View className="py-12 items-center justify-center">
            <Text className="font-body text-[15px] text-[#646464]">
              No {activeTab} orders found.
            </Text>
          </View>
        ) : (
          <View style={isLandscape ? { flexDirection: "row", flexWrap: "wrap", gap: 12 } : { gap: 12 }}>
            {displayedOrders.map((order) => {
              const formattedNum = generateOrderNumber(order.orderId || order.bookingId || order.id);
              const isDeclined = order.status === "declined" || order.status === "cancelled";

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
                        rawStatus: isDeclined ? "declined" : order.status,
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
                      borderColor: isDeclined ? "#FECDD3" : "#F0EBE1",
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                    isLandscape && { width: "49%", maxWidth: undefined },
                  ]}
                >
                  {/* Thumbnail Image */}
                  <Image
                    source={{ uri: order.imageUrl }}
                    className="w-20 h-20 rounded-[14px] bg-grey100"
                    resizeMode="cover"
                  />

                  {/* Right Details */}
                  <View className="flex-1 h-20 justify-between py-0.5">
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text className="font-body-bold text-[15px] text-black" numberOfLines={1}>
                          {order.atelierName}
                        </Text>
                        {isDeclined && (
                          <View style={{ backgroundColor: "#FDEAEA", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 10, color: "#DC2626" }}>
                              Declined
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text className="font-body text-[12px] text-[#8A7550] mt-0.5" numberOfLines={1}>
                        {order.garmentType} · Order: {formattedNum}
                      </Text>
                    </View>

                    {isDeclined ? (
                      <Text style={{ fontFamily: "WorkSans_500Medium", fontSize: 11.5, color: "#DC2626" }}>
                        Appointment request declined
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
