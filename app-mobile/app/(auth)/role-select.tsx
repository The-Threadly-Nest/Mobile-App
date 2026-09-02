import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions, ScrollView } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { User, Store, CheckCircle2 } from "lucide-react-native";

export default function RoleSelectScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isLandscape && {
            paddingTop: 8,
            paddingBottom: 16,
            maxWidth: 680,
            alignSelf: "center",
            width: "100%",
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}

        {/* Title Section */}
        <View style={[styles.titleSection, isLandscape && { marginBottom: 8 }]}>
          <Text style={[styles.categoryBadge, isLandscape && { marginBottom: 2 }]}>GET STARTED</Text>
          <Text style={[styles.title, isLandscape && { fontSize: 20, lineHeight: 26, marginBottom: 2 }]}>
            Choose your account type
          </Text>
          <Text style={[styles.subtitle, isLandscape && { fontSize: 13, lineHeight: 17 }]}>
            Select how you plan to use The Threadly Nest so we can tailor your experience.
          </Text>
        </View>

        {/* Role Cards Container — Side-by-side in landscape */}
        <View style={[styles.cardsContainer, isLandscape && { flexDirection: "row", gap: 12, marginVertical: 2 }]}>
          {/* Card 1: Customer */}
          <Pressable
            onPress={() => setSelectedRole("customer")}
            style={({ pressed }) => [
              styles.roleCard,
              isLandscape && { flex: 1, padding: 12, borderRadius: 16 },
              selectedRole === "customer" ? styles.roleCardSelected : styles.roleCardUnselected,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.cardHeaderRow, isLandscape && { marginBottom: 6 }]}>
              <View
                style={[
                  styles.iconCircle,
                  isLandscape && { width: 36, height: 36, borderRadius: 18 },
                  selectedRole === "customer"
                    ? styles.iconCircleSelected
                    : styles.iconCircleUnselected,
                ]}
              >
                <User
                  size={isLandscape ? 18 : 24}
                  color={selectedRole === "customer" ? "#FFFFFF" : "#4A080C"}
                />
              </View>
              {selectedRole === "customer" && (
                <CheckCircle2 size={isLandscape ? 18 : 24} color="#4A080C" />
              )}
            </View>

            <Text style={[styles.cardTitle, isLandscape && { fontSize: 16, marginBottom: 2 }]}>I'm a Customer</Text>
            <Text style={[styles.cardSubtitle, isLandscape && { fontSize: 12, lineHeight: 16 }]}>
              Discover top fashion houses, book fittings with AI assistant, track custom outfits, & save measurements.
            </Text>
          </Pressable>

          {/* Card 2: Fashion House Owner (Admin) */}
          <Pressable
            onPress={() => setSelectedRole("admin")}
            style={({ pressed }) => [
              styles.roleCard,
              isLandscape && { flex: 1, padding: 12, borderRadius: 16 },
              selectedRole === "admin" ? styles.roleCardSelected : styles.roleCardUnselected,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.cardHeaderRow, isLandscape && { marginBottom: 6 }]}>
              <View
                style={[
                  styles.iconCircle,
                  isLandscape && { width: 36, height: 36, borderRadius: 18 },
                  selectedRole === "admin"
                    ? styles.iconCircleSelected
                    : styles.iconCircleUnselected,
                ]}
              >
                <Store
                  size={isLandscape ? 18 : 24}
                  color={selectedRole === "admin" ? "#FFFFFF" : "#4A080C"}
                />
              </View>
              {selectedRole === "admin" && (
                <CheckCircle2 size={isLandscape ? 18 : 24} color="#4A080C" />
              )}
            </View>

            <Text style={[styles.cardTitle, isLandscape && { fontSize: 16, marginBottom: 2 }]}>Fashion House Owner</Text>
            <Text style={[styles.cardSubtitle, isLandscape && { fontSize: 12, lineHeight: 16 }]}>
              Manage orders, staff assignments, customer measurement sheets, invoices, and your digital storefront.
            </Text>
          </Pressable>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottomSection, isLandscape && { marginTop: 8, gap: 6, alignItems: "center" }]}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              isLandscape && { height: 44, borderRadius: 22 },
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FBF7EF",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    justifyContent: "flex-start",
  },
  header: {
    marginBottom: 0,
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
    marginBottom: 20,
  },
  categoryBadge: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#4A080C",
    marginBottom: 6,
  },
  title: {
    fontFamily: "Fraunces-Bold",
    fontSize: 26,
    lineHeight: 34,
    color: "#3B0508",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(74, 8, 12, 0.75)",
  },
  cardsContainer: {
    gap: 14,
    marginVertical: 4,
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
    maxWidth: 380,
    alignSelf: "center",
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
