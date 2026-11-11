import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: "#F9E8D3" } }} />;
}
