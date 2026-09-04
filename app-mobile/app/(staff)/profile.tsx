import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LogOut, Mail, ShieldCheck, Building } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";

export default function StaffProfileScreen() {
  const logout = useAuthStore((s) => s.logout);
  const name = useAuthStore((s) => s.name) || "Staff Member";
  const email = useAuthStore((s) => s.email) || "";
  const shopName = useAuthStore((s) => s.shopName) || "Luxury Fashion House";
  const initial = name.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    router.replace("/(auth)/login");
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
            <Building size={18} color="#8A7550" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Fashion House</Text>
              <Text style={styles.infoValue}>{shopName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Mail size={18} color="#8A7550" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <ShieldCheck size={18} color="#8A7550" />
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Account Status</Text>
              <Text style={styles.infoValue}>Active & Verified</Text>
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
          <LogOut size={18} color="#DC2626" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#4A080C",
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    color: "#FFFFFF",
  },
  userName: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 20,
    color: "#3A2E1A",
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: "#F4EFE6",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: "#C4A763",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(228, 213, 183, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 1,
    color: "#8A7550",
    marginBottom: 16,
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
    fontFamily: "WorkSans_400Regular",
    fontSize: 12,
    color: "#8A7550",
    marginBottom: 2,
  },
  infoValue: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 15,
    color: "#3A2E1A",
  },
  divider: {
    height: 1,
    backgroundColor: "#F4EFE6",
    marginVertical: 14,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  logoutBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 15,
    color: "#DC2626",
  },
});
