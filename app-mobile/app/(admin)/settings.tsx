import React, { useState, useEffect } from "react";
import {
  View,
  Pressable,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Users,
  Ruler,
  UserCheck,
  PenTool,
  FileText,
  Settings,
  Tag,
  Bell,
  HelpCircle,
  Shield,
  LogOut,
  ChevronRight,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { adminApi, ordersApi } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

export default function AdminSettingsScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { showAlert, showConfirm } = useAppAlert();

  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name);
  const email = useAuthStore((s) => s.email);
  const storedShopName = useAuthStore((s) => s.shopName);
  const [businessName, setBusinessName] = useState(storedShopName || name || "");

  const [staffCount, setStaffCount] = useState(3);
  const [customerCount, setCustomerCount] = useState(18);
  const [invoiceCount, setInvoiceCount] = useState(3);

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, ordersRes] = await Promise.allSettled([
          adminApi.getProfile(),
          ordersApi.getOrders(),
        ]);

        if (profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
          const house = profileRes.value.fashionHouse;
          if (house.shopName || house.name) {
            setBusinessName(house.shopName || house.name);
          }
        }

        if (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) {
          setInvoiceCount(ordersRes.value.length || 3);
        }
      } catch (err) {
        console.warn("Failed to load profile for settings", err);
      }
    }
    loadData();
  }, []);

  const emailPrefix = email ? email.split("@")[0] : "";
  const fallbackName = emailPrefix
    ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    : "Fashion House";
  const displayTitle = businessName || fallbackName;

  const handleLogout = () => {
    showConfirm("Log Out", "Are you sure you want to log out of your atelier account?", {
      confirmLabel: "Log Out",
      cancelLabel: "Cancel",
      onConfirm: () => {
        logout();
        router.replace("/(auth)/login");
      },
    });
  };

  // All features styled consistently in the 2-column grid
  const ALL_GRID_ITEMS = [
    {
      id: "customers",
      title: "Customers",
      subtitle: `${customerCount} total`,
      icon: Users,
      onPress: () => router.push("/(admin)/customers" as any),
    },
    {
      id: "measurements",
      title: "Measurements",
      subtitle: "New entry",
      icon: Ruler,
      onPress: () => router.push("/(admin)/measurements/new" as any),
    },
    {
      id: "staff",
      title: "Staff",
      subtitle: `${staffCount} members`,
      icon: UserCheck,
      onPress: () => router.push("/(admin)/staff" as any),
    },
    {
      id: "moodboards",
      title: "Moodboards",
      subtitle: "Cross-staff view",
      icon: PenTool,
      onPress: () => router.push("/(admin)/staff" as any),
    },
    {
      id: "invoices",
      title: "Invoices",
      subtitle: `${invoiceCount} this month`,
      icon: FileText,
      onPress: () => router.push("/(admin)/invoices" as any),
    },
    {
      id: "catalog",
      title: "Catalog",
      subtitle: "Collections & items",
      icon: Tag,
      onPress: () => router.push("/(admin)/catalog" as any),
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Store & profile",
      icon: Settings,
      onPress: () => router.push("/(admin)/profile-edit" as any),
    },
    {
      id: "notifications",
      title: "Notifications",
      subtitle: "Alerts & updates",
      icon: Bell,
      onPress: () => showAlert("Notifications", "Push notifications for new bookings and order updates are active."),
    },
    {
      id: "support",
      title: "Support",
      subtitle: "Concierge & help",
      icon: HelpCircle,
      onPress: () => showAlert("Support", "Need assistance? Contact our concierge team at concierge@threadlynest.com"),
    },
    {
      id: "privacy",
      title: "Privacy",
      subtitle: "Data & security",
      icon: Shield,
      onPress: () => showAlert("Privacy Policy", "All customer data & measurements are encrypted under tenant isolation."),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && styles.landscapeContainer,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Header */}
        <Text style={styles.screenTitle}>More</Text>

        {/* 1. Account & Atelier Card at the TOP */}
        <Pressable
          onPress={() => router.push("/(admin)/profile-edit" as any)}
          style={({ pressed }) => [
            styles.accountCard,
            { opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayTitle.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountName} numberOfLines={1}>
              {displayTitle}
            </Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {email || "admin@threadlynest.com"}
            </Text>
          </View>
          <ChevronRight size={18} color="#8A7550" />
        </Pressable>

        {/* 2. Unified 2-Column Grid */}
        <View style={styles.gridContainer}>
          {ALL_GRID_ITEMS.map((item) => {
            const IconComponent = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.gridCard,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                {/* Squircle Icon Container */}
                <View style={styles.iconContainer}>
                  <IconComponent size={22} color="#1A1110" />
                </View>

                {/* Card Text Content */}
                <View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  {item.subtitle ? (
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

          {/* 3. Log Out Card in Grid Format */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.gridCard,
              styles.logoutGridCard,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.iconContainer, styles.logoutIconContainer]}>
              <LogOut size={22} color="#DC2626" />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: "#DC2626" }]}>Log Out</Text>
              <Text style={styles.cardSubtitle}>Sign out of atelier</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  landscapeContainer: {
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  screenTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    color: "#1A1110",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  accountCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#FFFFFF",
  },
  accountName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 2,
  },
  accountEmail: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#8A7550",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    minHeight: 140,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  logoutGridCard: {
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.2)",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E4E1DB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoutIconContainer: {
    backgroundColor: "#FEE2E2",
  },
  cardTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#1A1110",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    color: "#7A7265",
  },
});
