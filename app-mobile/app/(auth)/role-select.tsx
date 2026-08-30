import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, User, Store, CheckCircle2 } from "lucide-react-native";

export default function RoleSelectScreen() {
  const [selectedRole, setSelectedRole] = useState<"customer" | "admin">("customer");

  const handleContinue = () => {
    if (selectedRole === "admin") {
      router.push("/admin-onboarding");
    } else {
      router.push("/onboarding");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* Top Navigation */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(auth)/welcome");
            }}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ArrowLeft size={20} color="#3B0508" />
          </Pressable>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.categoryBadge}>GET STARTED</Text>
          <Text style={styles.title}>Choose your account type</Text>
          <Text style={styles.subtitle}>
            Select how you plan to use The Threadly Nest so we can tailor your experience.
          </Text>
        </View>

        {/* Role Cards Container */}
        <View style={styles.cardsContainer}>
          {/* Card 1: Customer */}
          <Pressable
            onPress={() => setSelectedRole("customer")}
            style={({ pressed }) => [
              styles.roleCard,
              selectedRole === "customer" ? styles.roleCardSelected : styles.roleCardUnselected,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconCircle,
                  selectedRole === "customer"
                    ? styles.iconCircleSelected
                    : styles.iconCircleUnselected,
                ]}
              >
                <User
                  size={24}
                  color={selectedRole === "customer" ? "#FFFFFF" : "#4A080C"}
                />
              </View>
              {selectedRole === "customer" && (
                <CheckCircle2 size={24} color="#4A080C" />
              )}
            </View>

            <Text style={styles.cardTitle}>I'm a Customer</Text>
            <Text style={styles.cardSubtitle}>
              Discover top fashion houses, book fittings with AI assistant, track custom outfits, & save measurements.
            </Text>
          </Pressable>

          {/* Card 2: Fashion House Owner (Admin) */}
          <Pressable
            onPress={() => setSelectedRole("admin")}
            style={({ pressed }) => [
              styles.roleCard,
              selectedRole === "admin" ? styles.roleCardSelected : styles.roleCardUnselected,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconCircle,
                  selectedRole === "admin"
                    ? styles.iconCircleSelected
                    : styles.iconCircleUnselected,
                ]}
              >
                <Store
                  size={24}
                  color={selectedRole === "admin" ? "#FFFFFF" : "#4A080C"}
                />
              </View>
              {selectedRole === "admin" && (
                <CheckCircle2 size={24} color="#4A080C" />
              )}
            </View>

            <Text style={styles.cardTitle}>Fashion House Owner</Text>
            <Text style={styles.cardSubtitle}>
              Manage orders, staff assignments, customer measurement sheets, invoices, and your digital storefront.
            </Text>
          </Pressable>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.continueBtnText}>
              Continue as {selectedRole === "customer" ? "Customer" : "Fashion House"}
            </Text>
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.loginBold}>Log In</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  header: {
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    marginBottom: 24,
  },
  categoryBadge: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#4A080C",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    lineHeight: 36,
    color: "#3B0508",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(74, 8, 12, 0.75)",
  },
  cardsContainer: {
    gap: 16,
    marginVertical: 12,
  },
  roleCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
  },
  roleCardSelected: {
    borderColor: "#4A080C",
    backgroundColor: "#F4EFE6",
  },
  roleCardUnselected: {
    borderColor: "rgba(74, 8, 12, 0.15)",
    backgroundColor: "#FFFFFF",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleSelected: {
    backgroundColor: "#4A080C",
  },
  iconCircleUnselected: {
    backgroundColor: "#EBE0D3",
  },
  cardTitle: {
    fontFamily: "Fraunces-Bold",
    fontSize: 20,
    color: "#3B0508",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(74, 8, 12, 0.75)",
  },
  bottomSection: {
    gap: 16,
    marginTop: 16,
  },
  continueBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    backgroundColor: "#4A080C",
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "#3B0508",
  },
  loginBold: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 14,
    color: "#4A080C",
  },
});
