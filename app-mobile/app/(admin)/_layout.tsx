import { useEffect, useState, useRef } from "react";
import { AppState, View, Text } from "react-native";
import { Tabs, usePathname } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch, escalationsApi } from "@/shared/utils/apiClient";
import { FloatingTabBar } from "@/shared/components/FloatingTabBar";

function FloatingTabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: focused ? "#F96951" : "transparent" }}>{children}</View>;
}

// ─── Local Tray Notification for Admin Customer Inquiries & Escalations ───────
async function scheduleCustomerNotification(senderName: string, text: string) {
  try {
    const Notifications = require("expo-notifications");
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `💬 Customer Inquiry: ${senderName}`,
        body: text || "You have a new customer message or escalation.",
        sound: "default",
        data: { screen: "messages" },
      },
      trigger: null, // Fire immediately
    });
  } catch (e) {
    console.warn("[notification] Failed to schedule customer notification:", e);
  }
}

function DashboardIcon({ color, focused }: { color: string; focused: boolean }) {
  const activeColor = focused ? "#453332" : color;
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
          fill={color}
        />
        <Path d="M8 1.5V5" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <Path d="M16 1.5V5" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
        stroke={focused ? "#FFFFFF" : activeColor}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreIcon({ color, focused, unreadCount }: { color: string; focused: boolean; unreadCount: number }) {
  const activeColor = focused ? "#453332" : color;

  return (
    <View style={{ width: 26, height: 26, justifyContent: "center", alignItems: "center" }}>
      <Svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <Circle cx="6" cy="12" r="2" fill={activeColor} />
        <Circle cx="12" cy="12" r="2" fill={activeColor} />
        <Circle cx="18" cy="12" r="2" fill={activeColor} />
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

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const extraBottom = insets.bottom;
  const token = useAuthStore((s) => s.token);
  const pathname = usePathname();

  const [unreadCount, setUnreadCount] = useState(0);
  const prevCountRef = useRef(0);
  const pathnameRef = useRef(pathname);
  const appIsActiveRef = useRef(AppState.currentState === "active");

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    NavigationBar.setStyle("light");
  }, []);

  // ── Clear badge immediately when admin views customer messages or escalations ──────
  useEffect(() => {
    if (pathname.includes("messages") || pathname.includes("escalations")) {
      setUnreadCount(0);
      prevCountRef.current = 0;
    }
  }, [pathname]);

  // ── Poll for Customer Direct Messages & AI Escalations every 15s ───────────────────
  useEffect(() => {
    if (!token) return;

    const fetchCustomerUnread = async () => {
      if (!appIsActiveRef.current || pathnameRef.current.includes("messages")) return;
      try {
        // 1. Fetch customer direct message threads
        const threads = await apiFetch<any[]>("/api/direct-messages/threads", { silent: true });

        let threadsUnread = 0;
        let latestSender = "Customer";
        let latestMsg = "You have a new customer message.";

          if (Array.isArray(threads)) {
            threadsUnread = threads.reduce((acc: number, t: any) => acc + (t.unreadCount || 0), 0);
            const activeThread = threads.find((t: any) => t.unreadCount > 0);
            if (activeThread) {
              latestSender = activeThread.customerName || "Customer";
              latestMsg = activeThread.latestMessage || latestMsg;
            }
          }

        // 2. Fetch pending AI escalations count
        const escData = await escalationsApi.getEscalations();

        let escUnread = 0;
          const escalationsList = Array.isArray(escData) ? escData : [];
          escUnread = escalationsList.filter((e: any) => !e.resolved).length;

        const totalUnread = threadsUnread + escUnread;
        const isOnChatScreen =
          pathnameRef.current.includes("messages") ||
          pathnameRef.current.includes("escalations");

        if (isOnChatScreen) {
          setUnreadCount(0);
          prevCountRef.current = 0;
        } else {
          if (totalUnread > prevCountRef.current) {
            // New message/escalation arrived — trigger local system notification
            await scheduleCustomerNotification(latestSender, latestMsg);
          }
          prevCountRef.current = totalUnread;
          setUnreadCount(totalUnread);
        }
      } catch (e) {
        // Silent fail
      }
    };

    void fetchCustomerUnread();
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const becameActive = nextState === "active" && !appIsActiveRef.current;
      appIsActiveRef.current = nextState === "active";
      if (becameActive) void fetchCustomerUnread();
    });
    const interval = setInterval(() => void fetchCustomerUnread(), 30_000);
    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
    };
  }, [token]);

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <FloatingTabBar {...props} bottomInset={extraBottom} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#FFFFFF",
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 54, paddingTop: 0, paddingBottom: 0, borderRadius: 27, borderTopWidth: 0,
          backgroundColor: "#453332", elevation: 5, shadowColor: "#000000",
          shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
        },
        tabBarItemStyle: { height: 54 },
        tabBarLabelStyle: {
          fontFamily: "WorkSans_600SemiBold",
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
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><DashboardIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />

      {/* 2. Bookings Tab */}
      <Tabs.Screen
        name="escalations/index"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><BookingsIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />

      {/* 3. Orders Tab */}
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><OrdersIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />

      {/* 4. More Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "More",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><MoreIcon color={String(color)} focused={focused} unreadCount={unreadCount} /></FloatingTabIcon>,
        }}
      />

      {/* Hidden Non-Tab Routes */}
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile-edit" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="catalog/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="catalog/new" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="catalog/[id]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="messages" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="staff/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="moodboard" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="sketch-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="draw" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="staff/[staffId]/moodboard" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="measurements/new" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="invoices/[orderId]" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="invoices/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="order-detail" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="escalations/assign" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="customers/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="staff/invite" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="chat" options={{ href: null, tabBarStyle: { display: "none" } }} />
    </Tabs>
  );
}
