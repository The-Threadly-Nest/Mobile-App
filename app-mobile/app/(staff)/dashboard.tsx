import React from "react";
import { View, ScrollView, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Card } from "@/shared/components/Card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { mockOrders } from "@/shared/mockData";

export default function StaffDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView className="flex-1 px-5">
        <Headline className="text-2xl mt-4 mb-1">My Orders</Headline>
        <Subtext className="text-xs mb-6">Assigned by Admin — no direct customer messaging</Subtext>

        {mockOrders.map((o) => (
          <Card key={o.id} className="mb-3">
            <Text className="font-body-semibold text-ink mb-1">{o.customer}</Text>
            <Text className="font-body text-grey700 text-sm mb-3">{o.item}</Text>
            <View className="flex-row items-center justify-between">
              <StatusBadge status={o.status} />
              <Pressable className="bg-oxblood px-4 py-2 rounded-pill">
                <Text className="font-body-semibold text-cream text-xs">Update →</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
