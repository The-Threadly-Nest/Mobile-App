import { typeScale } from "@/shared/utils/typeScale";
import React from "react";
import { View, Pressable, StyleSheet, ScrollView } from "react-native";
import { Text } from "@/shared/components/Typography";
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
    router.replace("/");
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
          <LogOut size={18} color="#F96951" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F9E8D3",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 40,
  },
  pageTitle: {
    ...typeScale.pageTitle,
    color: "#4A403B",
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.5)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 26,
    color: "#FFFDF9",
  },
  userName: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 20,
    color: "#4A403B",
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: "#FFFDF9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 11,
    letterSpacing: 0.8,
    color: "#453332",
  },
  infoCard: {
    backgroundColor: "#FFFDF9",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(69, 51, 50, 0.5)",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    ...typeScale.sectionTitle,
    letterSpacing: 1,
    color: "#4A403B",
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
    backgroundColor: "#FFFDF9",
    borderWidth: 1.5,
    borderColor: "rgba(69, 51, 50, 0.3)",
  },
  logoutBtnText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 15,
    color: "#F96951",
  },
});
