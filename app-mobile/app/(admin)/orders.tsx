import React from "react";
import { View, FlatList, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Headline } from "@/shared/components/Headline";
import { Card } from "@/shared/components/Card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { mockOrders } from "@/shared/mockData";

export default function AdminOrdersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="px-5 pt-4 pb-2">
        <Headline className="text-2xl">Orders</Headline>
      </View>
      <FlatList
        data={mockOrders}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <Card className="mb-3">
            <View className="flex-row justify-between mb-2">
              <Text className="font-body-semibold text-ink">{item.customer}</Text>
              <Text className="font-body-semibold text-oxblood">₦{item.price.toLocaleString()}</Text>
            </View>
            <Text className="font-body text-grey700 text-sm mb-2">{item.item}</Text>
            <StatusBadge status={item.status} />
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
