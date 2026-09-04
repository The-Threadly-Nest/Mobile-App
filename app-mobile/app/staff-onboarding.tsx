import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";

const slides = [
  {
    image: require("../assets/staff-onboarding-1.png"),
    headline: "See exactly what’s\nassigned to you",
    subtitle: "See only the orders assigned to you.",
  },
  {
    image: require("../assets/staff-onboarding-2.png"),
    headline: "Update progress\nwith a single tap",
    subtitle: "Update orders instantly. No\nforms or back-and-forth.",
  },
  {
    image: require("../assets/staff-onboarding-3.png"),
    headline: "Keep a private\nmood board",
    subtitle: "Save private sketches. Your\nAdmin can feature them later.",
  },
];

export default function StaffOnboardingScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const email = useAuthStore((s) => s.email);
  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setBackgroundColorAsync("transparent");
      NavigationBar.setBehaviorAsync("overlay-swipe");
      NavigationBar.setButtonStyleAsync("light");
    }
  }, []);

  const handleNext = () => {
    if (isLast) {
      router.replace({
        pathname: "/(auth)/reset-password",
        params: { email, firstTimeStaff: "true" },
      });
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    router.replace({
      pathname: "/(auth)/reset-password",
      params: { email, firstTimeStaff: "true" },
    });
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        key={currentIndex}
        source={slide.image}
        style={styles.bgImage}
        resizeMode="cover"
      >
        {/* Dark Overlay for Text Legibility */}
        <View style={styles.darkOverlay} />

        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          {/* Main Content Box */}
          <View style={[styles.contentBox, isLandscape && styles.contentBoxLandscape]}>


            {/* Headline */}
            <Text style={styles.headline}>{slide.headline}</Text>

            {/* Subtitle */}
            <Text style={styles.subtitle}>{slide.subtitle}</Text>

            {/* Pagination Indicators */}
            <View style={styles.paginationRow}>
              {slides.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === currentIndex ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              ))}
            </View>

            {/* Bottom Actions Row */}
            <View style={styles.buttonRow}>
              {isLast ? (
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => [
                    styles.nextBtn,
                    styles.fullWidthBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.nextBtnText}>Get Started</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={handleSkip}
                    style={({ pressed }) => [
                      styles.skipBtn,
                      { opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Text style={styles.skipBtnText}>Skip</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleNext}
                    style={({ pressed }) => [
                      styles.nextBtn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <Text style={styles.nextBtnText}>Next</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  safeArea: {
    flex: 1,
    justifyContent: "flex-end",
  },
  contentBox: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    alignItems: "center",
  },
  contentBoxLandscape: {
    maxWidth: 520,
    alignSelf: "center",
  },
  headline: {
    fontFamily: "Fraunces-Bold",
    fontSize: 28,
    lineHeight: 36,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "WorkSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.85)",
    textAlign: "center",
    marginBottom: 24,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 32,
    backgroundColor: "#FFFFFF",
  },
  inactiveDot: {
    width: 6,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 14,
    width: "100%",
    maxWidth: 380,
  },
  skipBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  nextBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4A080C", // Oxblood
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtnText: {
    fontFamily: "WorkSans_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  fullWidthBtn: {
    width: "100%",
  },
});
