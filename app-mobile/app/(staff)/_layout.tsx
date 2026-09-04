import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Tabs } from "expo-router";
import * as NavigationBar from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

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

function ChatIcon({ color, focused, unreadCount }: { color: string; focused: boolean; unreadCount: number }) {
  const activeColor = focused ? "#4A080C" : color;

  return (
    <View style={{ width: 24, height: 24, justifyContent: "center", alignItems: "center" }}>
      <Svg width="22" height="21" viewBox="0 0 22 21" fill="none">
        <Path
          d="M20.4158 16.4143C20.7909 16.0392 21.0016 15.5305 21.0016 15.0001V3.00001C21.0016 2.46957 20.7909 1.96086 20.4158 1.58579C20.0407 1.21071 19.5319 1 19.0014 1H3.00016C2.46968 1 1.96094 1.21071 1.58583 1.58579C1.21073 1.96086 1 2.46957 1 3.00001V19.2861C1.00002 19.4265 1.04167 19.5638 1.1197 19.6805C1.19772 19.7972 1.30861 19.8882 1.43834 19.942C1.56808 19.9957 1.71083 20.0098 1.84856 19.9824C1.98628 19.955 2.11279 19.8874 2.2121 19.7881L4.41427 17.5861C4.78929 17.211 5.29795 17.0002 5.82839 17.0001H19.0014C19.5319 17.0001 20.0407 16.7894 20.4158 16.4143Z"
          stroke={activeColor}
          strokeWidth="2"
          strokeLinecap="round"
          fill={focused ? activeColor : "none"}
        />
      </Svg>
      {unreadCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -4,
            backgroundColor: "#D32F2F",
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            paddingHorizontal: 3,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
          }}
        >
          <Text style={{ fontFamily: "WorkSans_600SemiBold", fontSize: 8, color: "#FFFFFF", textAlign: "center" }}>
            {unreadCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MoodboardIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#4A080C" : "#000000";
  const strokeWidth = focused ? "1.8" : "1.5";
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.8095 3.94012C20.2695 7.78012 16.4095 13.0001 13.1795 15.5901L11.2095 17.1701C10.9595 17.3501 10.7095 17.5101 10.4295 17.6201C10.4295 17.4401 10.4195 17.2401 10.3895 17.0501C10.2795 16.2101 9.89953 15.4301 9.22953 14.7601C8.54953 14.0801 7.71953 13.6801 6.86953 13.5701C6.66953 13.5601 6.46953 13.5401 6.26953 13.5601C6.37953 13.2501 6.54953 12.9601 6.75953 12.7201L8.31953 10.7501C10.8995 7.52012 16.1395 3.64012 19.9695 2.11012C20.5595 1.89012 21.1295 2.05012 21.4895 2.42012C21.8695 2.79012 22.0495 3.36012 21.8095 3.94012Z"
        fill={focused ? activeColor : "none"}
        stroke={activeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.4303 17.6201C10.4303 18.7201 10.0103 19.77 9.22027 20.57C8.61027 21.18 7.78027 21.6001 6.79027 21.7301L4.33027 22.0001C2.99027 22.1501 1.84027 21.01 2.00027 19.65L2.27027 17.1901C2.51027 15.0001 4.34027 13.6001 6.28027 13.5601C6.48027 13.5501 6.69027 13.56 6.88027 13.57C7.73027 13.68 8.56027 14.0701 9.24027 14.7601C9.91027 15.4301 10.2903 16.21 10.4003 17.05C10.4103 17.24 10.4303 17.4301 10.4303 17.6201Z"
        fill={focused ? activeColor : "none"}
        stroke={activeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.2398 14.47C14.2398 11.86 12.1198 9.73999 9.50977 9.73999"
        stroke={activeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ProfileIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#4A080C" : "#000000";
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        fill={focused ? "#4A080C" : "none"}
        stroke={activeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
        fill={focused ? "#4A080C" : "none"}
        stroke={activeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function StaffLayout() {
  const insets = useSafeAreaInsets();
  const extraBottom = insets.bottom;
  const token = useAuthStore((s) => s.token);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync("#FFFFFF");
    NavigationBar.setButtonStyleAsync("dark");
  }, []);

  useEffect(() => {
    (async () => {
      if (!token) return;
      try {
        const meRes = await fetch(`${API_BASE_URL}/api/staff/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          if (me.id) {
            const sessionRes = await fetch(`${API_BASE_URL}/api/chat/session/${me.id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (sessionRes.ok) {
              const session = await sessionRes.json();
              const history = session.history || [];
              let unread = 0;
              if (
                history.length > 0 &&
                (history[history.length - 1].role === "admin" || history[history.length - 1].role === "model")
              ) {
                for (let i = history.length - 1; i >= 0; i--) {
                  if (history[i].role === "admin" || history[i].role === "model") unread++;
                  else break;
                }
              }
              setUnreadCount(unread);
            }
          }
        }
      } catch (e) {}
    })();
  }, [token]);

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4A080C",
        tabBarInactiveTintColor: "#000000",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "rgba(0, 0, 0, 0.05)",
          borderTopWidth: 1,
          height: 58 + Math.max(14, extraBottom),
          paddingTop: 6,
          paddingBottom: Math.max(14, extraBottom),
        },
        tabBarLabelStyle: {
          fontFamily: "WorkSans_600SemiBold",
          fontSize: 12,
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => <OrdersIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ color, focused }) => <ChatIcon color={color} focused={focused} unreadCount={unreadCount} />,
        }}
      />
      <Tabs.Screen
        name="moodboard"
        options={{
          title: "Mood Board",
          tabBarIcon: ({ color, focused }) => <MoodboardIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <ProfileIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="update-progress"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="order-details"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="draw"
        options={{
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}
