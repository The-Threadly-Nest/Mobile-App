import { useEffect } from "react";
import { Tabs } from "expo-router";
import { LayoutGrid, PenTool, User } from "lucide-react-native";
import * as NavigationBar from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function StaffLayout() {
  const insets = useSafeAreaInsets();
  const extraBottom = insets.bottom;

  useEffect(() => {
    // Match nav bar to default white tab bar
    NavigationBar.setBackgroundColorAsync("#FFFFFF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4A080C",
        tabBarInactiveTintColor: "#8A7550",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "rgba(0, 0, 0, 0.05)",
          borderTopWidth: 1,
          height: 58 + Math.max(14, extraBottom),
          paddingTop: 6,
          paddingBottom: Math.max(14, extraBottom),
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }} />
      <Tabs.Screen name="moodboard" options={{ title: "Mood Board", tabBarIcon: ({ color, size }) => <PenTool color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}

