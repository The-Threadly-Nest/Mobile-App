import React from "react";
import { View, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Headline } from "@/shared/components/Headline";
import { useAuthStore } from "@/stores/useAuthStore";

export default function StaffProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="px-5 pt-4">
        <Headline className="text-2xl mb-6">Profile</Headline>
        <Pressable onPress={() => { logout(); router.replace("/(auth)/login"); }} className="py-4">
          <Text className="font-body text-red-500">Log Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
