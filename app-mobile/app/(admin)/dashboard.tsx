import React from "react";
import { View, ScrollView, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { Card } from "@/shared/components/Card";

export default function AdminDashboard() {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView className="flex-1 px-5">
        <Subtext className="text-xs mt-4">Good morning</Subtext>
        <Headline className="text-2xl mb-6">Amara's Atelier</Headline>

        <View className="flex-row gap-3 mb-5">
          <Card className="flex-1">
            <Subtext className="text-xs mb-1">Active Orders</Subtext>
            <Headline className="text-2xl">12</Headline>
          </Card>
          <View className="flex-1 bg-gold rounded-xl p-4">
            <Text className="font-body text-ink text-xs mb-1">Revenue</Text>
            <Text className="font-display text-ink text-xl">₦482k</Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/(admin)/measurements/new")}
          className="flex-row items-center justify-center bg-oxblood py-4 mb-6 rounded-pill"
        >
          <Plus size={18} color="#FBF7EF" />
          <Text className="font-body-semibold text-cream ml-2">Take New Measurement</Text>
        </Pressable>

        <Headline className="text-lg mb-3">Booking Requests</Headline>
        <Card className="mb-3">
          <Text className="font-body-semibold text-ink">Amaka Johnson</Text>
          <Subtext className="text-sm">Wants: fitted wedding guest dress</Subtext>
          <Text className="font-body text-gold text-xs mt-1">Via Smart Chat</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
