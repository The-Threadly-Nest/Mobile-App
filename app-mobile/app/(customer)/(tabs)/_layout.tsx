import { Tabs } from "expo-router";
import { Home, ShoppingCart, UserRound } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#404040",
        tabBarStyle: {
          backgroundColor: "#FBF7EF",
          borderTopColor: "rgba(64, 64, 64, 0.2)",
          borderTopWidth: 0.5,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "WorkSans_500Medium",
          fontSize: 12,
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="browse"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size || 22} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "My Orders",
          tabBarIcon: ({ color, size }) => (
            <ShoppingCart color={color} size={size || 22} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <UserRound color={color} size={size || 22} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}
