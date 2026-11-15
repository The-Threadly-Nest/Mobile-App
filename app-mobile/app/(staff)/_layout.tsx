export const unstable_settings = { anchor: "dashboard" };
import { useActivityBadges, ActivityBadge } from "@/shared/components/ActivityBadges";
import { useEffect, useState, useRef } from "react";
import { AppState, View } from "react-native";
import { Text } from "@/shared/components/Typography";
import { Tabs, usePathname, Redirect } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { FloatingTabBar } from "@/shared/components/FloatingTabBar";
import Constants, { ExecutionEnvironment } from "expo-constants";

function FloatingTabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return <View style={{ width: 38, height: 38, borderRadius: 19, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: focused ? "#453332" : "transparent" }}>{children}</View>;
}

// ─── Schedule a local tray notification for a new incoming chat message ───────
async function scheduleMessageNotification(senderName: string, text: string) {
  try {
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return;
    const Notifications = require("expo-notifications");
    if (typeof Notifications?.scheduleNotificationAsync === "function") {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💬 New message from ${senderName}`,
          body: text || "You have a new message.",
          sound: "default",
          data: { screen: "chat" },
        },
        trigger: null, // fire immediately
      });
    }
  } catch (e) {
    // Graceful no-op in dev/Expo Go
  }
}

function OrdersIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? color : color;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {focused && (
        <Path
          d="M5.82 3.87L4.75 13.96C4.61 15.59 5.9 16.99 7.54 16.99H18.19C19.63 16.99 20.89 15.81 21 14.38L21.54 6.88C21.66 5.22 20.4 3.87 18.73 3.87H5.82Z"
          fill={color}
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
        stroke={focused ? "#FFFDF9" : activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChatIcon({ color, unreadCount }: { color: string; focused: boolean; unreadCount: number }) {
  return <View style={{ width: 24, height: 24 }}>
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 19H8C4 19 2 18 2 13V8C2 4 4 2 8 2H16C20 2 22 4 22 8V13C22 17 20 19 16 19H15.5C15.19 19 14.89 19.15 14.7 19.4L13.2 21.4C12.54 22.28 11.46 22.28 10.8 21.4L9.3 19.4C9.14 19.18 8.77 19 8.5 19Z" stroke={color} strokeWidth={1.5} strokeMiterlimit={10} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15.9965 11H16.0054M11.9955 11H12.0045M7.99451 11H8.00349" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
    {unreadCount > 0 && <View style={{ position: "absolute", top: -5, right: -7, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, backgroundColor: "#453332", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 9 }}>{unreadCount > 99 ? "99+" : unreadCount}</Text></View>}
  </View>;
}

function MoodboardIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? color : color;
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
  const activeColor = focused ? color : color;
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
        fill={focused ? color : "none"}
        stroke={activeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.59 22C20.59 18.13 16.74 15 12 15C7.26 15 3.41 18.13 3.41 22"
        fill={focused ? color : "none"}
        stroke={activeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function StaffLayout() {
  const { messages: activityCount } = useActivityBadges();
  const insets = useSafeAreaInsets();
  const extraBottom = insets.bottom;
  const token = useAuthStore((s) => s.token);
  const pathname = usePathname();

  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(0);          // tracks previous count to detect NEW messages
  const staffIdRef = useRef<string | null>(null); // caches staff id to avoid repeated /me calls
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    NavigationBar.setStyle("light");
  }, []);

  // ── Clear badge immediately when the user navigates to the chat tab ────────
  useEffect(() => {
    if (pathname.includes("/chat")) {
      setUnreadCount(0);
      prevCountRef.current = 0;
    }
  }, [pathname]);

  // ── Poll for unread messages every 15 seconds ──────────────────────────────
  useEffect(() => {
    if (!token) return;

    const fetchUnread = async () => {
      try {
        // 1. Resolve staff ID once and cache it
        if (!staffIdRef.current) {
          const me = await apiFetch<any>("/api/staff/me", { silent: true });
          if (!me.id) return;
          staffIdRef.current = me.id;
        }

        // 2. Fetch chat session
        const session = await apiFetch<any>(`/api/chat/session/${staffIdRef.current}`, { silent: true });
        const history: any[] = session.history || [];

        // 3. Count trailing admin/model messages (= unread for staff)
        let unread = 0;
        if (
          history.length > 0 &&
          (history[history.length - 1].role === "admin" ||
            history[history.length - 1].role === "model")
        ) {
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === "admin" || history[i].role === "model") unread++;
            else break;
          }
        }

        // 4. If user is on the chat screen keep badge at 0; otherwise update & notify
        const isOnChat = pathnameRef.current.includes("/chat");
        if (isOnChat) {
          setUnreadCount(0);
          prevCountRef.current = 0;
        } else {
          if (unread > prevCountRef.current) {
            // New message(s) arrived — fire a local system notification
            const lastMsg = history[history.length - 1];
            await scheduleMessageNotification(
              "Fashion House Admin",
              lastMsg?.text || "You have a new message."
            );
          }
          prevCountRef.current = unread;
          setUnreadCount(unread);
        }
      } catch (e) {
        // Silent fail — badge simply won't update on network errors
      }
    };

    // Fire immediately, then every 15 seconds
    fetchUnread();
    const interval = setInterval(fetchUnread, 15_000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const sendPresence = () => {
      if (AppState.currentState === "active") {
        void apiFetch("/api/staff/presence", { method: "POST", silent: true });
      }
    };
    sendPresence();
    const interval = setInterval(sendPresence, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sendPresence();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [token]);

  if (!token) return <Redirect href="/(auth)/login" />;
  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={(props) => props.state.routes[props.state.index]?.name === "chat" ? null : <FloatingTabBar {...props} bottomInset={extraBottom} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FFFDF9",
        tabBarInactiveTintColor: "#FFFDF9",
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 54, paddingTop: 0, paddingBottom: 0, borderRadius: 27, borderTopWidth: 0,
          backgroundColor: "#F96951", elevation: 5, shadowColor: "#2B2B2B",
          shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
        },
        tabBarItemStyle: { height: 54 },
        tabBarLabelStyle: {
          fontFamily: "InstrumentSans-SemiBold",
          fontSize: 12,
          marginTop: 1,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><OrdersIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Message admin",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><ChatIcon color={String(color)} focused={focused} unreadCount={activityCount} /></FloatingTabIcon>,
        }}
      />
      <Tabs.Screen
        name="moodboard"
        options={{
          title: "Mood Board",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><MoodboardIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><ProfileIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
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
