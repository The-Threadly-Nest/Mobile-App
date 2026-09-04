import { Stack } from "expo-router";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="fashion-house/[fashionHouseId]" />
      <Stack.Screen name="reviews/[fashionHouseId]" />
      <Stack.Screen name="orders/[orderId]" />
      <Stack.Screen name="confirmation" options={{ presentation: "modal" }} />
    </Stack>
  );
}
