import React from "react";
import { View, FlatList, Pressable, Image, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Star } from "lucide-react-native";
import { Headline, Subtext } from "@/shared/components/Headline";
import { mockFashionHouses } from "@/shared/mockData";

export default function BrowseScreen() {
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="px-5 pt-4">
        <Headline className="text-2xl mb-1">Discover</Headline>
        <Subtext className="text-sm mb-4">Fashion houses near you</Subtext>
      </View>
      <FlatList
        data={mockFashionHouses}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(customer)/fashion-house/${item.id}`)}
            className="border border-grey100 bg-white rounded-xl overflow-hidden mb-4"
          >
            <Image source={{ uri: item.image }} className="w-full h-44" />
            <View className="p-4">
              <Text className="font-body-semibold text-ink text-base">{item.name}</Text>
              <View className="flex-row items-center mt-1">
                <Text className="font-body text-grey700 text-xs">{item.location} · </Text>
                <Star size={12} color="#C4A763" fill="#C4A763" />
                <Text className="font-body text-grey700 text-xs ml-1">{item.rating}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
