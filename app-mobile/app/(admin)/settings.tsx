import React from "react";
import { View, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { Headline } from "@/shared/components/Headline";
import { useAuthStore } from "@/stores/useAuthStore";

const ITEMS = ["Profile & Business Info", "Notifications", "Help & Support", "Privacy Policy"];

export default function AdminSettingsScreen() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="px-5 pt-4">
        <Headline className="text-2xl mb-6">Settings</Headline>
        {ITEMS.map((label) => (
          <Pressable key={label} className="flex-row items-center justify-between py-4 border-b border-grey100">
            <Text className="font-body text-ink">{label}</Text>
            <ChevronRight size={18} color="#A6926B" />
          </Pressable>
        ))}
        <Pressable onPress={() => { logout(); router.replace("/(auth)/login"); }} className="py-4 mt-4">
          <Text className="font-body text-red-500">Log Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
