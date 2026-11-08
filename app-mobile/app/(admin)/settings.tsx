import React, { useState, useCallback } from "react";
import {
  View,
  Pressable,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronLeft,
  User,
  Tag,
  PenTool,
  Users,
  Ruler,
  FileText,
  Calendar,
  LogOut,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { adminApi } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";
import { ProfileDesignIcon, ProfileMenuGroups } from "@/shared/components/ProfileDesign";
import { formatCurrency } from "@/shared/utils/formatters";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

const TOMATO = "#FF6347";

export default function AdminSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert, showConfirm } = useAppAlert();

  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name);
  const storedShopName = useAuthStore((s) => s.shopName);
  const token = useAuthStore((s) => s.token);

  const [businessName, setBusinessName] = useState(storedShopName || name || "");
  const availableBalance = "Not connected";

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function loadData() {
        if (!token) return;
        try {
          const [profileRes] = await Promise.allSettled([
            adminApi.getProfile(),
          ]);

          if (active && profileRes.status === "fulfilled" && profileRes.value?.fashionHouse) {
            const house = profileRes.value.fashionHouse;
            if (house.shopName || house.name) {
              setBusinessName(house.shopName || house.name);
            }
          }

        } catch {
          // fallback
        }
      }
      void loadData();
      return () => {
        active = false;
      };
    }, [token])
  );

  const handleLogout = () => {
    showConfirm("Log Out", "Are you sure you want to log out of your Owuja account?", {
      confirmLabel: "Log Out",
      cancelLabel: "Cancel",
      onConfirm: () => {
        logout();
        router.replace("/(auth)/login");
      },
    });
  };

  const handleBack = () => {
    router.replace("/(admin)/dashboard" as any);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 32, 60) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Header Card (Figma Node 201:4329) ─── */}
        <View style={styles.headerCard}>
          <View style={styles.topNavRow}>
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [styles.circularBackBtn, { opacity: pressed ? 0.75 : 1 }]}
            >
              <ChevronLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>
            <Text style={styles.headerTitle}>My Profile</Text>
          </View>

          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{availableBalance}</Text>

          <Pressable
            disabled={true}
            style={[styles.withdrawBtn, { opacity: 0.45, borderColor: "rgba(255, 255, 255, 0.4)" }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
          >
            <Text style={[styles.withdrawBtnText, { color: "rgba(255, 255, 255, 0.6)" }]}>Withdraw</Text>
          </Pressable>
        </View>

        {/* ─── Menu Groups Styled in Tomato like Profile Page ─── */}
        <View style={styles.menuContainer}>
          <ProfileMenuGroups>
            {/* 1. Personal Info */}
            <Pressable
              onPress={() => router.push("/(admin)/profile-edit")}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <User size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Personal Info</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 2. Catalog */}
            <Pressable
              onPress={() => router.push("/(admin)/catalog")}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <Tag size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Catalog</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 3. Moodboard */}
            <Pressable
              onPress={() => router.push("/(admin)/moodboard")}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <PenTool size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Moodboard</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 4. Staff */}
            <Pressable
              onPress={() => router.push("/(admin)/staff")}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <Users size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Staff</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 5. Customers & Measurements */}
            <Pressable
              onPress={() => router.push("/(admin)/customers")}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <Ruler size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Customers & Measurements</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 6. Invoices */}
            <Pressable
              onPress={() => router.push("/(admin)/invoices")}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <FileText size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Invoices</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 7. Fitting Slots */}
            <Pressable
              onPress={() => router.push("/(admin)/fitting-slots" as any)}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <Calendar size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Fitting Slots</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>

            {/* 8. Log Out */}
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.75 : 1 }]}
            >
              <View style={styles.iconCircle}>
                <LogOut size={22} color={TOMATO} strokeWidth={1.8} />
              </View>
              <Text style={styles.menuRowTitle}>Log Out</Text>
              <ProfileDesignIcon name="chevron" />
            </Pressable>
          </ProfileMenuGroups>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#453332",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: "#453332",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 26,
    alignItems: "center",
  },
  topNavRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  circularBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 24,
    lineHeight: 28,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  balanceLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.85)",
    marginBottom: 6,
  },
  balanceValue: {
    fontFamily: "InstrumentSans-Bold",
    fontSize: 34,
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  withdrawBtn: {
    borderWidth: 1,
    borderColor: "#FFFFFF",
    borderRadius: 9,
    paddingHorizontal: 20,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawBtnText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 13,
    color: "#000000",
  },
  menuContainer: {
    paddingTop: 20,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 74,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    elevation: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  menuRowTitle: {
    flex: 1,
    fontFamily: "InstrumentSans-Medium",
    fontSize: 14,
    color: "#000000",
  },
});
