import { typeScale } from "@/shared/utils/typeScale";
import React, { useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions, ScrollView } from "react-native";
import { Text } from "@/shared/components/Typography";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShoppingBag, Scissors, Check } from "lucide-react-native";
import BackArrowIcon from "@/shared/components/BackArrowIcon";
import { SCREEN_TOP_SPACING } from "@/shared/utils/screenSpacing";

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
          isLandscape && { maxWidth: 680, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Back Navigation */}
        <View style={styles.navRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <BackArrowIcon size={24} color="#453332" />
          </Pressable>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.categoryBadge}>GET STARTED</Text>
          <Text style={styles.title}>Choose your account type</Text>
          <Text style={styles.subtitle}>
            Select how you'll be using Owuja so we can tailor your experience.
          </Text>
        </View>

        {/* Role Cards Container */}
        <View style={[styles.cardsContainer, isLandscape && { flexDirection: "row", gap: 12 }]}>
          {/* Card 1: Shopper / Customer */}
          <Pressable
            onPress={() => setSelectedRole("customer")}
            style={({ pressed }) => [
              styles.roleCard,
              selectedRole === "customer" ? styles.roleCardSelected : styles.roleCardUnselected,
              isLandscape && { flex: 1 },
              { opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconCircle,
                  selectedRole === "customer" ? styles.iconCircleSelected : styles.iconCircleUnselected,
                ]}
              >
                <ShoppingBag
                  size={22}
                  color={selectedRole === "customer" ? "#FFFDF9" : "#453332"}
                  strokeWidth={1.8}
                />
              </View>

              {/* Radio Indicator */}
              <View
                style={[
                  styles.radioCircle,
                  selectedRole === "customer" ? styles.radioSelected : styles.radioUnselected,
                ]}
              >
                {selectedRole === "customer" && <Check size={14} color="#FFFDF9" strokeWidth={2.5} />}
              </View>
            </View>

            <Text style={styles.cardEyebrow}>INDIVIDUAL CLIENT</Text>
            <Text style={styles.cardTitle}>I'm a Shopper</Text>
            <Text style={styles.cardSubtitle}>
              Discover top Nigerian fashion houses, commission bespoke pieces, book AI fittings, and track orders.
            </Text>

            {/* Feature Pills */}
            <View style={styles.featurePillsRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>Bespoke Outfits</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>AI Fitting</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>Live Tracking</Text>
              </View>
            </View>
          </Pressable>

          {/* Card 2: Fashion House / Creator */}
          <Pressable
            onPress={() => setSelectedRole("admin")}
            style={({ pressed }) => [
              styles.roleCard,
              selectedRole === "admin" ? styles.roleCardSelected : styles.roleCardUnselected,
              isLandscape && { flex: 1 },
              { opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconCircle,
                  selectedRole === "admin" ? styles.iconCircleSelected : styles.iconCircleUnselected,
                ]}
              >
                <Scissors
                  size={22}
                  color={selectedRole === "admin" ? "#FFFDF9" : "#453332"}
                  strokeWidth={1.8}
                />
              </View>

              {/* Radio Indicator */}
              <View
                style={[
                  styles.radioCircle,
                  selectedRole === "admin" ? styles.radioSelected : styles.radioUnselected,
                ]}
              >
                {selectedRole === "admin" && <Check size={14} color="#FFFDF9" strokeWidth={2.5} />}
              </View>
            </View>

            <Text style={styles.cardEyebrow}>CREATOR & BUSINESS</Text>
            <Text style={styles.cardTitle}>Fashion House Owner</Text>
            <Text style={styles.cardSubtitle}>
              Manage bespoke commissions, tailor assignments, digital measurement sheets, invoices, and your brand storefront.
            </Text>

            {/* Feature Pills */}
            <View style={styles.featurePillsRow}>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>Client Measurements</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>Order Studio</Text>
              </View>
              <View style={styles.featurePill}>
                <Text style={styles.featurePillText}>Storefront</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueBtn,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.continueBtnText}>
              Continue as {selectedRole === "customer" ? "Shopper" : "Fashion House"}
            </Text>
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable onPress={() => router.push("/(auth)/login")} hitSlop={6}>
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
    backgroundColor: "#FFFFFF",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: SCREEN_TOP_SPACING,
    paddingBottom: 28,
  },
  navRow: {
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,

    alignItems: "flex-start",
    justifyContent: "center",
  },
  titleSection: {
    marginBottom: 22,
  },
  categoryBadge: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 11,
    letterSpacing: 1.5,
    color: "#453332",
    marginBottom: 6,
  },
  title: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 28,
    lineHeight: 36,
    color: "#453332",
    marginBottom: 6,
  },
  subtitle: {
    ...typeScale.caption,
    color: "#4A403B",
  },
  cardsContainer: {
    gap: 14,
    marginBottom: 24,
  },
  roleCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1.5,
  },
  roleCardSelected: {
    borderColor: "#453332",
    backgroundColor: "#FFFDF9",
  },
  roleCardUnselected: {
    borderColor: "#453332",
    backgroundColor: "#FFFDF9",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleSelected: {
    backgroundColor: "#453332",
  },
  iconCircleUnselected: {
    backgroundColor: "#F9E8D3",
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: "#453332",
  },
  radioUnselected: {
    borderWidth: 1.5,
    borderColor: "#453332",
    backgroundColor: "transparent",
  },
  cardEyebrow: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#453332",
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 21,
    color: "#453332",
    marginBottom: 6,
  },
  cardSubtitle: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#4A403B",
    marginBottom: 14,
  },
  featurePillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  featurePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(69, 51, 50, 0.06)",
  },
  featurePillText: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 11,
    color: "#453332",
  },
  bottomSection: {
    gap: 16,
    marginTop: "auto",
  },
  continueBtn: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#453332",
    alignItems: "center",
    justifyContent: "center",
  },
  continueBtnText: {
    ...typeScale.button,
    color: "#FFFDF9",
    letterSpacing: 0.2,
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#4A403B",
  },
  loginBold: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#453332",
  },
});
