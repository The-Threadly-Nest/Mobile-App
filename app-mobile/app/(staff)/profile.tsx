import { typeScale } from "@/shared/utils/typeScale";
import React, { useState, useCallback } from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { LogOut, Mail, ShieldCheck, Building } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiFetch } from "@/shared/utils/apiClient";
import { useAppAlert } from "@/shared/hooks/useAppAlert";

export default function StaffProfileScreen() {
  const { showConfirm } = useAppAlert();
  const logout = useAuthStore((s) => s.logout);
  const storedName = useAuthStore((s) => s.name);
  const storedEmail = useAuthStore((s) => s.email);
  const storedShop = useAuthStore((s) => s.shopName);
  const isVerified = useAuthStore((s) => s.isVerified);
  const token = useAuthStore((s) => s.token);
  const [profile, setProfile] = useState<{ name?: string; email?: string; shopName?: string } | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (token) void apiFetch<{ name?: string; email?: string; shopName?: string }>("/api/staff/me", { cache: "reload", silent: true }).then(value => { if (active) setProfile(value); }).catch(() => {});
    return () => { active = false; };
  }, [token]));
  const name = profile?.name || storedName || "Staff member";
  const email = profile?.email || storedEmail || "";
  const shopName = profile?.shopName || storedShop || "Not available";
  const initial = name.charAt(0).toUpperCase();

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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.pageTitle}>Profile</Text>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.userName}>{name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>STAFF MEMBER</Text>
          </View>
        </View>

        {/* Account Information Section */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionHeader}>ACCOUNT INFORMATION</Text>

          <View style={styles.infoRow}>
            <Building size={18} color="#453332" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Fashion House</Text>
              <Text style={styles.infoValue}>{shopName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Mail size={18} color="#453332" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <ShieldCheck size={18} color="#453332" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Account Status</Text>
              <Text style={styles.infoValue}>{isVerified ? "Verified staff account" : "Staff account"}</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <LogOut size={18} color="#FFFFFF" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 120,
  },
  pageTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 0,
    borderColor: "rgba(69, 51, 50, 0.5)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 0,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F9E8D3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 32,
    color: "#453332",
  },
  userName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 20,
    color: "#4A403B",
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: "#F9E8D3",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleBadgeText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: "#453332",
  },
  infoCard: {
    backgroundColor: "#F9E8D3",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 0,
    borderColor: "rgba(69, 51, 50, 0.5)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 0,
    gap: 20,
  },
  sectionHeader: {
    ...typeScale.sectionTitle,
    letterSpacing: 1,
    color: "#4A403B",
    marginBottom: 0,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 12,
    color: "#4A403B",
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 15,
    color: "#4A403B",
  },
  divider: {
    display: "none",
    height: 1,
    backgroundColor: "#FFFDF9",
    marginVertical: 14,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F96951",
    borderWidth: 0,
    borderColor: "rgba(69, 51, 50, 0.3)",
  },
  logoutBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#FFFFFF",
  },
});
