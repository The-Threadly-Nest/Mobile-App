import { Tabs } from "expo-router";
import { Search, ShoppingBag, User } from "lucide-react-native";

export default function CustomerLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4A080C", tabBarInactiveTintColor: "#8A7550" }}>
      <Tabs.Screen name="browse" options={{ title: "Discover", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "My Orders", tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
