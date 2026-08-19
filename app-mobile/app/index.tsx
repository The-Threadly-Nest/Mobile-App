import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";

export default function Splash() {
  useEffect(() => {
    const t = setTimeout(() => router.replace("/(auth)/login"), 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <View className="flex-1 bg-oxblood items-center justify-center">
      <Text className="font-display text-cream text-2xl tracking-tight">THE THREADLY NEST</Text>
    </View>
  );
}
