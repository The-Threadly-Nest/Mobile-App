import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check } from "lucide-react-native";
import { useAuthStore } from "@/stores/useAuthStore";
import { API_BASE_URL } from "@/api/config";

const SHOPPING_CATEGORIES = [
  "Bridal",
  "Aso-Ebi",
  "Agbada",
  "Kaftan",
  "Senator Wear",
  "Everyday Tailoring",
  "Gele & Accessories",
];

const BUDGET_OPTIONS = [
  { id: "budget", symbol: "₦", label: "Budget" },
  { id: "mid", symbol: "₦₦", label: "Mid-range" },
  { id: "premium", symbol: "₦₦₦", label: "Premium" },
];

const TIMING_OPTIONS = ["2-4 weeks", "This week", "Just browsing"];

export default function PersonalizeScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBudget, setSelectedBudget] = useState<string>("");
  const [selectedTiming, setSelectedTiming] = useState<string>("");

  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(false);

  // Dynamic progress calculation (fills from 15% to 100% as choices are picked)
  const catScore = Math.min(selectedCategories.length / 3, 1) * 40; // up to 40%
  const budgetScore = selectedBudget ? 30 : 0; // 30%
  const timingScore = selectedTiming ? 30 : 0; // 30%
  const progressPercent = Math.max(
    15,
    Math.min(100, Math.round(catScore + budgetScore + timingScore))
  );

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories((prev) => prev.filter((c) => c !== category));
    } else {
      setSelectedCategories((prev) => [...prev, category]);
    }
  };

  const handleContinue = async () => {
    try {
      setLoading(true);
      if (token && API_BASE_URL) {
        await fetch(`${API_BASE_URL}/api/preferences`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            styles: selectedCategories,
            budget: selectedBudget,
            timeline: selectedTiming,
          }),
        });
      }
    } catch (e) {
      console.warn("Failed to save preferences:", e);
    } finally {
      setLoading(false);
      router.replace("/(customer)/browse");
    }
  };

  const handleSkip = () => {
    router.replace("/(customer)/browse");
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isLandscape && {
            paddingTop: 8,
            paddingBottom: 20,
            maxWidth: 680,
            alignSelf: "center",
            width: "100%",
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dynamic Progress Line - Directly above PERSONALIZE text */}
        <View style={[styles.progressBarTrack, isLandscape && { marginBottom: 12, marginTop: 4 }]}>
          <View
            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
          />
        </View>

        {/* Category Label */}
        <Text style={[styles.categoryLabel, isLandscape && { marginBottom: 4 }]}>PERSONALIZE</Text>

        {/* Headline */}
        <Text style={[styles.headline, isLandscape && { fontSize: 22, lineHeight: 28, marginBottom: 4 }]}>What’s your style?</Text>
        <Text style={[styles.subtext, isLandscape && { fontSize: 13, lineHeight: 18, marginBottom: 16 }]}>
          Pick a few things and we'll tailor your Discover feed to match.
        </Text>

        {/* Section 1: Shopping for */}
        <View style={[styles.section, isLandscape && { marginBottom: 16 }]}>
          <Text style={styles.sectionTitle}>What are you shopping for?</Text>
          <Text style={[styles.sectionSubtitle, isLandscape && { marginBottom: 8 }]}>Choose as many as you like.</Text>

          <View style={styles.pillsWrapContainer}>
            {SHOPPING_CATEGORIES.map((item) => {
              const isSelected = selectedCategories.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleCategory(item)}
                  style={({ pressed }) => [
                    styles.pillButton,
                    styles.pillButtonEqual,
                    isLandscape && { width: "31%", paddingVertical: 8, borderRadius: 20 },
                    isSelected ? styles.pillSelected : styles.pillUnselected,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  {isSelected && (
                    <Check size={isLandscape ? 14 : 16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.pillText,
                      isLandscape && { fontSize: 13 },
                      isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 2: Budget Range */}
        <View style={[styles.section, isLandscape && { marginBottom: 16 }]}>
          <Text style={styles.sectionTitle}>Your budget range</Text>

          <View style={[styles.budgetSegmentContainer, isLandscape && { height: 46, marginTop: 8 }]}>
            {BUDGET_OPTIONS.map((option) => {
              const isSelected = selectedBudget === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedBudget(option.id)}
                  style={({ pressed }) => [
                    styles.budgetSegment,
                    isSelected && styles.budgetSegmentSelected,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.budgetSymbolText,
                      isSelected ? styles.budgetTextSelected : styles.budgetTextUnselected,
                    ]}
                  >
                    {option.symbol}
                  </Text>
                  <Text
                    style={[
                      styles.budgetLabelText,
                      isSelected ? styles.budgetTextSelected : styles.budgetTextUnselected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 3: Timing */}
        <View style={[styles.section, isLandscape && { marginBottom: 16 }]}>
          <Text style={styles.sectionTitle}>How soon do you need it?</Text>

          <View style={styles.pillsWrapContainer}>
            {TIMING_OPTIONS.map((item) => {
              const isSelected = selectedTiming === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setSelectedTiming(item)}
                  style={({ pressed }) => [
                    styles.pillButton,
                    isLandscape && { paddingVertical: 8, borderRadius: 20 },
                    isSelected ? styles.pillSelected : styles.pillUnselected,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  {isSelected && (
                    <Check size={isLandscape ? 14 : 16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  )}
                  <Text
                    style={[
                      styles.pillText,
                      isLandscape && { fontSize: 13 },
                      isSelected ? styles.pillTextSelected : styles.pillTextUnselected,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.actionsContainer, isLandscape && { flexDirection: "row", gap: 12, marginTop: 12 }]}>
          {/* Continue Button */}
          <Pressable
            onPress={handleContinue}
            disabled={loading}
            style={({ pressed }) => [
              styles.continueBtn,
              isLandscape && { flex: 1, height: 48, borderRadius: 24 },
              { opacity: pressed || loading ? 0.85 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueBtnText}>Continue</Text>
            )}
          </Pressable>

          {/* Skip for now Button */}
          <Pressable
            onPress={handleSkip}
            style={({ pressed }) => [
              styles.skipBtn,
              isLandscape && { flex: 1, height: 48, borderRadius: 24 },
              { opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={styles.skipBtnText}>Skip for now</Text>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  progressBarTrack: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(74, 8, 12, 0.15)",
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 24,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4A080C",
    borderRadius: 2,
  },
  categoryLabel: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 12,
    letterSpacing: 1.2,
    color: "#4A080C",
    marginBottom: 12,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "Fraunces-Bold",
    fontSize: 30,
    lineHeight: 36,
    color: "#3B0508",
    marginBottom: 8,
  },
  subtext: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(74, 8, 12, 0.75)",
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3B0508",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 14,
    color: "rgba(74, 8, 12, 0.60)",
    marginBottom: 16,
  },
  pillsWrapContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    borderWidth: 1,
  },
  pillButtonEqual: {
    width: "47%",
  },
  pillUnselected: {
    backgroundColor: "transparent",
    borderColor: "rgba(74, 8, 12, 0.35)",
  },
  pillSelected: {
    backgroundColor: "#4A080C",
    borderColor: "#4A080C",
  },
  pillText: {
    fontFamily: "WorkSans_500Medium",
    fontSize: 15,
  },
  pillTextUnselected: {
    color: "#3B0508",
  },
  pillTextSelected: {
    color: "#FFFFFF",
  },
  budgetSegmentContainer: {
    flexDirection: "row",
    backgroundColor: "#E4E1DB",
    borderRadius: 28,
    padding: 4,
    height: 60,
    alignItems: "center",
    marginTop: 12,
  },
  budgetSegment: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
  },
  budgetSegmentSelected: {
    backgroundColor: "#4A080C",
  },
  budgetSymbolText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 13,
    lineHeight: 16,
  },
  budgetLabelText: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 13,
    lineHeight: 16,
  },
  budgetTextUnselected: {
    color: "rgba(74, 8, 12, 0.65)",
  },
  budgetTextSelected: {
    color: "#FFFFFF",
  },
  actionsContainer: {
    marginTop: 20,
    gap: 12,
    width: "100%",
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
  skipBtn: {
    width: "100%",
    height: 63,
    borderRadius: 31.5,
    borderWidth: 1,
    borderColor: "rgba(74, 8, 12, 0.4)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#3B0508",
    letterSpacing: 0.2,
  },
});
