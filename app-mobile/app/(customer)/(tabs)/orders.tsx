import React from "react";
import { View, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Card } from "@/shared/components/Card";

const STAGES = ["Order Placed", "In Production", "Ready", "Delivered"];
const CURRENT = 1;

export default function CustomerOrdersScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView className="flex-1 px-5">
        <Headline className="text-2xl mt-4 mb-6">My Orders</Headline>

        <Card>
          <Text className="font-body-semibold text-ink text-base mb-1">Wedding Guest Dress</Text>
          <Subtext className="text-xs mb-5">Amara's Atelier</Subtext>

          <View className="flex-row justify-between mb-2">
            {STAGES.map((stage, i) => (
              <View key={stage} className="items-center flex-1">
                <View className={`w-3.5 h-3.5 rounded-full ${i <= CURRENT ? "bg-oxblood" : "bg-grey100"}`} />
                <Text className="font-body text-xs text-grey700 mt-2 text-center">{stage}</Text>
              </View>
            ))}
          </View>

          <Subtext className="text-xs mt-4">
            Status updates only — the fashion house will reach out directly if anything needs your input.
          </Subtext>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
