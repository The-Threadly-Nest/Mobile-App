import { Tabs } from "expo-router";
import { LayoutGrid, PenTool, User } from "lucide-react-native";

export default function StaffLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: "#4A080C", tabBarInactiveTintColor: "#8A7550" }}>
      <Tabs.Screen name="dashboard" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }} />
      <Tabs.Screen name="moodboard" options={{ title: "Mood Board", tabBarIcon: ({ color, size }) => <PenTool color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
