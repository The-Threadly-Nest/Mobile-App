import { useEffect, useState, useRef } from "react";
import { AppState, View } from "react-native";
import { Text } from "@/shared/components/Typography";
import { Tabs, usePathname } from "expo-router";
import { NavigationBar } from "expo-navigation-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch, escalationsApi } from "@/shared/utils/apiClient";
import { FloatingTabBar } from "@/shared/components/FloatingTabBar";
import { Plus } from "lucide-react-native";

function FloatingTabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: 44, width: 44 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? "#453332" : "transparent",
        }}
      >
        {children}
      </View>
    </View>
  );
}

function CenterPlusTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: 44, width: 44 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F9E8D3",
        }}
      >
        <Plus size={22} color="#F96951" strokeWidth={2.4} />
      </View>
    </View>
  );
}

// ─── Local Tray Notification for Admin Customer Inquiries & Escalations ───────

function DashboardIcon({ color }: { color: string; focused: boolean }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3C7.5 3 4.5 6.8 4.5 11.2V17.8C4.5 19.8 6 21.2 8 21.2H16C18 21.2 19.5 19.8 19.5 17.8V11.2C19.5 6.8 16.5 3 12 3Z"
        stroke={color}
        strokeWidth="1.8"
      />
      <Rect x="8.5" y="9.5" width="3" height="3" rx="0.8" stroke={color} strokeWidth="1.3" />
      <Rect x="12.5" y="9.5" width="3" height="3" rx="0.8" stroke={color} strokeWidth="1.3" />
      <Rect x="8.5" y="13.5" width="3" height="3" rx="0.8" stroke={color} strokeWidth="1.3" />
      <Rect x="12.5" y="13.5" width="3" height="3" rx="0.8" stroke={color} strokeWidth="1.3" />
    </Svg>
  );
}

function BookingsIcon({ color }: { color: string; focused: boolean }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path d="M8 2V5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 2V5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 12H17" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 16H13" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M17 3.5C20.3 3.7 21.5 5 21.5 9.5V15.5C21.5 19.5 20.5 21.5 16 21.5H8C3.5 21.5 2.5 19.5 2.5 15.5V9.5C2.5 5 3.7 3.7 7 3.5H17Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function OrdersIcon({ color }: { color: string; focused: boolean }) {
  return (
    <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 2H3.74001C4.82001 2 5.67 2.93 5.58 4L4.75 13.96C4.61 15.59 5.89999 16.99 7.53999 16.99H18.19C19.63 16.99 20.89 15.81 21 14.38L21.54 6.88C21.66 5.22 20.4 3.87 18.73 3.87H5.82001"
        stroke={color}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="16.25" cy="20.75" r="1.5" stroke={color} strokeWidth="1.8" />
      <Circle cx="8.25" cy="20.75" r="1.5" stroke={color} strokeWidth="1.8" />
      <Path
        d="M9 8H21"
        stroke={color}
        strokeWidth="1.8"
        strokeMiterlimit="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MoreIcon({ color, unreadCount }: { color: string; focused: boolean; unreadCount: number }) {
  return (
    <View style={{ width: 22, height: 22, justifyContent: "center", alignItems: "center" }}>
      <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <Circle cx="6" cy="12" r="2" fill={color} />
        <Circle cx="12" cy="12" r="2" fill={color} />
        <Circle cx="18" cy="12" r="2" fill={color} />
      </Svg>
      {unreadCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -2,
            right: -4,
            backgroundColor: "#453332",
            minWidth: 14,
            height: 14,
            borderRadius: 7,
            paddingHorizontal: 3,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "InstrumentSans-SemiBold", fontSize: 8, color: "#FFFDF9", textAlign: "center" }}>
            {unreadCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const ADMIN_ALLOWED_TAB_ROUTES = ["dashboard", "escalations/index", "orders", "settings"];

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
            // Push delivery comes from the server. Polling updates badges only,
            // otherwise the same message produces a second local notification.
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
      initialRouteName="dashboard"
      backBehavior="initialRoute"
      tabBar={(props) => (
        <FloatingTabBar
          {...props}
          bottomInset={extraBottom}
          allowedRoutes={ADMIN_ALLOWED_TAB_ROUTES}
        />
      )}
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
          title: "Order requests",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><BookingsIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />

      {/* 3. Add Item (Upload Clothes) Tab */}
      <Tabs.Screen
        name="catalog/new"
        options={{
          title: "Add Item",
          tabBarIcon: ({ focused }) => <CenterPlusTabIcon focused={focused} />,
        }}
      />

      {/* 4. Orders Tab */}
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><OrdersIcon color={String(color)} focused={focused} /></FloatingTabIcon>,
        }}
      />

      {/* 5. More Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => <FloatingTabIcon focused={focused}><MoreIcon color={String(color)} focused={focused} unreadCount={unreadCount} /></FloatingTabIcon>,
        }}
      />

      {/* Hidden Non-Tab Routes */}
      <Tabs.Screen name="profile" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="profile-edit" options={{ href: null, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="catalog/index" options={{ href: null, tabBarStyle: { display: "none" } }} />
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
