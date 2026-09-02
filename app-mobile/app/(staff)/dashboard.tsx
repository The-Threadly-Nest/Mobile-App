import React from "react";
import { View, ScrollView, Pressable, Text, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Card } from "@/shared/components/Card";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { mockOrders } from "@/shared/mockData";

export default function StaffDashboard() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={isLandscape ? { maxWidth: 840, alignSelf: "center", width: "100%" } : undefined}
      >
        <Headline className="text-2xl mt-4 mb-1">My Orders</Headline>
        <Subtext className="text-xs mb-6">Assigned by Admin — no direct customer messaging</Subtext>

        <View style={isLandscape ? { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 } : undefined}>
          {mockOrders.map((o) => (
            <View key={o.id} style={isLandscape ? { width: "50%", paddingHorizontal: 6 } : undefined}>
              <Card className="mb-3">
                <Text className="font-body-semibold text-ink mb-1">{o.customer}</Text>
                <Text className="font-body text-grey700 text-sm mb-3">{o.item}</Text>
                <View className="flex-row items-center justify-between">
                  <StatusBadge status={o.status} />
                  <Pressable className="bg-oxblood px-4 py-2 rounded-pill">
                    <Text className="font-body-semibold text-cream text-xs">Update →</Text>
                  </Pressable>
                </View>
              </Card>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
