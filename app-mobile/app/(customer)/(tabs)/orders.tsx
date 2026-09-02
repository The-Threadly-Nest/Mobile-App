import React, { useState, useEffect } from "react";
import { View, ScrollView, Text, Pressable, Image, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useOrdersStore, OrderItem } from "@/stores/useOrdersStore";
import { apiFetch } from "@/shared/utils/apiClient";

export default function CustomerOrdersScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const storeOrders = useOrdersStore((s) => s.orders);
  const setStoreOrders = useOrdersStore((s) => s.setOrders);

  useEffect(() => {
    let mounted = true;
    async function fetchCustomerOrders() {
      try {
        const fetched = await apiFetch<OrderItem[]>("/api/orders/my-orders", { silent: true }).catch(() => []);
        if (mounted && Array.isArray(fetched)) {
          if (fetched.length > 0) {
            // Deduplicate server orders and store orders by orderNumber or id
            const map = new Map<string, OrderItem>();
            fetched.forEach((f) => {
              const key = f.orderNumber || f.id;
              map.set(key, f);
            });
            setStoreOrders(Array.from(map.values()));
          }
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

  const activeOrders = storeOrders.filter((o) => o.status === "active");
  const completedOrders = storeOrders.filter((o) => o.status === "completed");
  const displayedOrders = activeTab === "active" ? activeOrders : completedOrders;

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
        <View style={[{ width: "100%", maxWidth: 376, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 }, isLandscape && { maxWidth: 600 }]}>
          <Pressable
            onPress={() => setActiveTab("active")}
            className={`flex-1 h-[44px] max-w-[176px] rounded-full items-center justify-center ${
              activeTab === "active" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
            }`}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text
              className={`font-body-semibold text-[15px] ${
                activeTab === "active" ? "text-white" : "text-[#404040]"
              }`}
            >
              Active ({activeOrders.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("completed")}
            className={`flex-1 h-[44px] max-w-[176px] rounded-full items-center justify-center ${
              activeTab === "completed" ? "bg-[#4A080C]" : "bg-[#E2E2E2]"
            }`}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
          >
            <Text
              className={`font-body-semibold text-[15px] ${
                activeTab === "completed" ? "text-white" : "text-[#404040]"
              }`}
            >
              Completed ({completedOrders.length})
            </Text>
          </Pressable>
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
            {displayedOrders.map((order) => (
              <View
                key={order.id}
                style={[
                  {
                    width: "100%",
                    maxWidth: 376,
                    height: 100,
                    alignSelf: "center",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                    backgroundColor: "#FFFFFF",
                    borderRadius: 20,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: "#F0EBE1",
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
                    <Text className="font-body-bold text-[15px] text-black" numberOfLines={1}>
                      {order.atelierName}
                    </Text>

                    <Text className="font-body text-[12px] text-[#8A7550] mt-0.5" numberOfLines={1}>
                      {order.garmentType} · Order: {order.orderNumber}
                    </Text>
                  </View>

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
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
