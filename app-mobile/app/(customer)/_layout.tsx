import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";
import { View } from "react-native";
import FloatingCart from "@/shared/components/FloatingCart";

export default function CustomerLayout() {
  const token = useAuthStore(state => state.token);
  if (!token) return <Redirect href="/(auth)/login" />;
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="fashion-house/[fashionHouseId]" />
      <Stack.Screen name="catalog/[id]" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="reviews/[fashionHouseId]" />
      <Stack.Screen name="orders/[orderId]" />
      <Stack.Screen name="confirmation" options={{ presentation: "modal" }} />
    </Stack>
    <FloatingCart />
    </View>
  );
}
