import { Tabs } from "expo-router";
import { LayoutGrid, Users, ShoppingBag, AlertCircle, Settings } from "lucide-react-native";

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4A080C", tabBarInactiveTintColor: "#8A7550" }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }} />
      <Tabs.Screen name="staff/index" options={{ title: "Staff", tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }} />
      <Tabs.Screen name="escalations/index" options={{ title: "Handoffs", tabBarIcon: ({ color, size }) => <AlertCircle color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
