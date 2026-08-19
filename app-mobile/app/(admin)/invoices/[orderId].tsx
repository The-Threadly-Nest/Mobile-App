import React from "react";
import { View, ScrollView, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { ChevronLeft, Share2 } from "lucide-react-native";
import { Headline } from "@/shared/components/Headline";
import { Button } from "@/shared/components/Button";
import { mockOrders } from "@/shared/mockData";

export default function InvoiceScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const order = mockOrders.find((o: any) => o.id === orderId) ?? mockOrders[0];
  const deposit = Math.round(order.price * 0.4);
  const balance = order.price - deposit;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3">
            <ChevronLeft size={24} color="#4A080C" />
          </Pressable>
          <Headline className="text-xl">Invoice</Headline>
        </View>
        <Share2 size={20} color="#4A080C" />
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="border border-oxblood rounded-xl p-6 mt-2">
          <Text className="font-display text-oxblood text-lg mb-1">THE THREADLY NEST</Text>
          <Text className="font-body text-grey700 text-xs mb-6">Invoice #INV-0004</Text>

          <View className="flex-row justify-between mb-1">
            <Text className="font-body text-grey700">Billed to</Text>
            <Text className="font-body-semibold text-ink">{order.customer}</Text>
          </View>
          <View className="border-t border-grey100 my-3" />

          <View className="flex-row justify-between mb-4">
            <Text className="font-body text-ink">{order.item}</Text>
            <Text className="font-body text-ink">₦{order.price.toLocaleString()}</Text>
          </View>

          <View className="flex-row justify-between mb-1">
            <Text className="font-body text-grey700">Deposit Paid</Text>
            <Text className="font-body text-ink">₦{deposit.toLocaleString()}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="font-body-semibold text-ink">Balance Due</Text>
            <Text className="font-body-semibold text-oxblood">₦{balance.toLocaleString()}</Text>
          </View>
        </View>

        <View className="my-6">
          <Button label="Share via WhatsApp" variant="accent" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
