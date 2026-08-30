import React, { useState } from "react";
import { View, ScrollView, Text, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface OrderItem {
  id: string;
  atelierName: string;
  garmentType: string;
  orderNumber: string;
  estimatedReady: string;
  progressPercent: number;
  imageUrl: string;
  status: "active" | "completed";
}

const MOCK_ORDERS: OrderItem[] = [
  {
    id: "1",
    atelierName: "Adaeze Couture",
    garmentType: "Aso-Ebi",
    orderNumber: "#TFH-2291",
    estimatedReady: "27 Sept, 2026",
    progressPercent: 65,
    imageUrl: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=300&q=80",
    status: "active",
  },
  {
    id: "2",
    atelierName: "Kaftan & Co.",
    garmentType: "Agbada",
    orderNumber: "#TFH-2291",
    estimatedReady: "03 Oct, 2026",
    progressPercent: 40,
    imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&q=80",
    status: "active",
  },
];

export default function CustomerOrdersScreen() {
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  const activeOrders = MOCK_ORDERS.filter((o) => o.status === "active");
  const completedOrders = MOCK_ORDERS.filter((o) => o.status === "completed");
  const displayedOrders = activeTab === "active" ? activeOrders : completedOrders;

  return (
    <SafeAreaView className="flex-1 bg-[#FBF7EF]" edges={["top"]}>
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 40, gap: 6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title (Fraunces SemiBold 24px, 122x30px) */}
        <View className="w-full max-w-[376px] self-center mb-1">
          <Text className="font-display text-[24px] font-semibold text-black h-[30px]">
            My Orders
          </Text>
        </View>

        {/* Tab Filter Pills (Equal responsive sizing with explicit gap-4 space between) */}
        <View className="w-full max-w-[376px] self-center flex-row items-center justify-center gap-4 my-0">
          <Pressable
            onPress={() => setActiveTab("active")}
            className={`flex-1 h-[48px] max-w-[176px] rounded-full items-center justify-center ${
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
            className={`flex-1 h-[48px] max-w-[176px] rounded-full items-center justify-center ${
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
        <View className="gap-4 -mt-2">
          {displayedOrders.length === 0 ? (
            <View className="py-12 items-center justify-center">
              <Text className="font-body text-[15px] text-[#646464]">
                No {activeTab} orders found.
              </Text>
            </View>
          ) : (
            displayedOrders.map((order) => (
              <View
                key={order.id}
                className="w-full max-w-[376px] h-[100px] self-center flex-row items-center gap-4"
              >
                {/* Thumbnail Image */}
                <Image
                  source={{ uri: order.imageUrl }}
                  className="w-20 h-20 rounded-[16px] bg-grey100"
                  resizeMode="cover"
                />

                {/* Right Details */}
                <View className="flex-1 h-20 justify-between py-0.5">
                  <View>
                    <Text className="font-body-bold text-[16px] text-black">
                      {order.atelierName}
                    </Text>

                    <Text className="font-body text-[13px] text-[#8A7550] mt-0.5">
                      {order.garmentType} · Order: {order.orderNumber}
                    </Text>
                  </View>

                  <View>
                    {/* Progress Bar (235x4px) */}
                    <View className="w-[235px] h-[4px] bg-[#E0E0E0] rounded-full overflow-hidden mb-1.5">
                      <View
                        className="h-full bg-[#C4A763] rounded-full"
                        style={{ width: `${order.progressPercent}%` }}
                      />
                    </View>

                    <Text className="font-body text-[13px] text-[#646464]">
                      Estimated ready: {order.estimatedReady}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
