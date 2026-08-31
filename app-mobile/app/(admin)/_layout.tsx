import { useEffect } from "react";
import { Tabs } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import Svg, { Path, Circle, Rect } from "react-native-svg";

function DashboardIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#4A080C" : color;
  if (focused) {
    return (
      <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3C7.5 3 4.5 6.8 4.5 11.2V17.8C4.5 19.8 6 21.2 8 21.2H16C18 21.2 19.5 19.8 19.5 17.8V11.2C19.5 6.8 16.5 3 12 3Z"
          fill={activeColor}
        />
        <Rect x="8.5" y="9.5" width="3" height="3" rx="0.8" fill="#FFFFFF" />
        <Rect x="12.5" y="9.5" width="3" height="3" rx="0.8" fill="#FFFFFF" />
        <Rect x="8.5" y="13.5" width="3" height="3" rx="0.8" fill="#FFFFFF" />
        <Rect x="12.5" y="13.5" width="3" height="3" rx="0.8" fill="#FFFFFF" />
      </Svg>
    );
  }
  return (
    <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3C7.5 3 4.5 6.8 4.5 11.2V17.8C4.5 19.8 6 21.2 8 21.2H16C18 21.2 19.5 19.8 19.5 17.8V11.2C19.5 6.8 16.5 3 12 3Z"
        stroke={activeColor}
        strokeWidth="1.8"
      />
      <Rect x="8.5" y="9.5" width="3" height="3" rx="0.8" stroke={activeColor} strokeWidth="1.3" />
      <Rect x="12.5" y="9.5" width="3" height="3" rx="0.8" stroke={activeColor} strokeWidth="1.3" />
      <Rect x="8.5" y="13.5" width="3" height="3" rx="0.8" stroke={activeColor} strokeWidth="1.3" />
      <Rect x="12.5" y="13.5" width="3" height="3" rx="0.8" stroke={activeColor} strokeWidth="1.3" />
    </Svg>
  );
}

function BookingsIcon({ color, focused }: { color: string; focused: boolean }) {
  if (focused) {
    return (
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <Path
          d="M17 3.5C20.3 3.7 21.5 5 21.5 9.5V15.5C21.5 19.5 20.5 21.5 16 21.5H8C3.5 21.5 2.5 19.5 2.5 15.5V9.5C2.5 5 3.7 3.7 7 3.5H17Z"
          fill="#4A080C"
        />
        <Path d="M8 1.5V5" stroke="#4A080C" strokeWidth="2" strokeLinecap="round" />
        <Path d="M16 1.5V5" stroke="#4A080C" strokeWidth="2" strokeLinecap="round" />
        <Path d="M7.5 11.5H16.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        <Path d="M7.5 15.5H13" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path d="M8 2V5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 2V5" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 12H17" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 16H13" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M17 3.5C20.3 3.7 21.5 5 21.5 9.5V15.5C21.5 19.5 20.5 21.5 16 21.5H8C3.5 21.5 2.5 19.5 2.5 15.5V9.5C2.5 5 3.7 3.7 7 3.5H17Z"
        stroke="#000000"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OrdersIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#4A080C" : "#000000";
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {focused && (
        <Path
          d="M5.82 3.87L4.75 13.96C4.61 15.59 5.9 16.99 7.54 16.99H18.19C19.63 16.99 20.89 15.81 21 14.38L21.54 6.88C21.66 5.22 20.4 3.87 18.73 3.87H5.82Z"
          fill="#4A080C"
        />
      )}
      <Path
        d="M2 2H3.74001C4.82001 2 5.67 2.93 5.58 4L4.75 13.96C4.61 15.59 5.89999 16.99 7.53999 16.99H18.19C19.63 16.99 20.89 15.81 21 14.38L21.54 6.88C21.66 5.22 20.4 3.87 18.73 3.87H5.82001"
        stroke={activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.25 22C16.9404 22 17.5 21.4404 17.5 20.75C17.5 20.0596 16.9404 19.5 16.25 19.5C15.5596 19.5 15 20.0596 15 20.75C15 21.4404 15.5596 22 16.25 22Z"
        stroke={activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? activeColor : "none"}
      />
      <Path
        d="M8.25 22C8.94036 22 9.5 21.4404 9.5 20.75C9.5 20.0596 8.94036 19.5 8.25 19.5C7.55964 19.5 7 20.0596 7 20.75C7 21.4404 7.55964 22 8.25 22Z"
        stroke={activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? activeColor : "none"}
      />
      <Path
        d="M9 8H21"
        stroke={focused ? "#FFFFFF" : activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#4A080C" : color;
  return (
    <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <Circle cx="6" cy="12" r="2" fill={activeColor} />
      <Circle cx="12" cy="12" r="2" fill={activeColor} />
      <Circle cx="18" cy="12" r="2" fill={activeColor} />
    </Svg>
  );
}

export default function AdminLayout() {
  useEffect(() => {
    // Match Android navigation bar to white background
    NavigationBar.setBackgroundColorAsync("#FFFFFF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4A080C",
        tabBarInactiveTintColor: "#000000",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "rgba(0, 0, 0, 0.05)",
          borderTopWidth: 1,
          height: 72,
          paddingTop: 6,
          paddingBottom: 14,
        },
        tabBarLabelStyle: {
          fontFamily: "WorkSans_500Medium",
          fontSize: 12,
          marginTop: 1,
        },
      }}
    >
      {/* 1. Dashboard Tab */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => <DashboardIcon color={color} focused={focused} />,
        }}
      />

      {/* 2. Bookings Tab */}
      <Tabs.Screen
        name="escalations/index"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => <BookingsIcon color={color} focused={focused} />,
        }}
      />

      {/* 3. Orders Tab */}
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => <OrdersIcon color={color} focused={focused} />,
        }}
      />

      {/* 4. More Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => <MoreIcon color={color} focused={focused} />,
        }}
      />

      {/* Hidden Non-Tab Routes */}
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile-edit" options={{ href: null }} />
      <Tabs.Screen name="catalog/index" options={{ href: null }} />
      <Tabs.Screen name="catalog/new" options={{ href: null }} />
      <Tabs.Screen name="staff/index" options={{ href: null }} />
      <Tabs.Screen name="staff/[staffId]/moodboard" options={{ href: null }} />
      <Tabs.Screen name="measurements/new" options={{ href: null }} />
      <Tabs.Screen name="invoices/[orderId]" options={{ href: null }} />
    </Tabs>
  );
}
