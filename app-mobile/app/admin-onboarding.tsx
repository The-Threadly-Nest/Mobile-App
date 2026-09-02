import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as NavigationBar from "expo-navigation-bar";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";

const adminSlides = [
  {
    image: require("../assets/admin-onboarding-1.png"),
    headline: "Your whole atelier,\nin one dashboard",
    subtitle: "Track bookings, revenue,\norders, and staff in one place.",
  },
  {
    image: require("../assets/admin-onboarding-2.png"),
    headline: "Assign work to your\ntailors in seconds",
    subtitle: "Assign bookings and track\norders effortlessly.",
  },
  {
    image: require("../assets/admin-onboarding-3.png"),
    headline: "Invoice and get\npaid, all in the app",
    subtitle: "Generate invoices and save\ncustomer measurements.",
  },
];

export default function AdminOnboardingSlidesScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = adminSlides[currentIndex];
  const isLast = currentIndex === adminSlides.length - 1;

  useEffect(() => {
    // Transparent nav bar so background image fills edge-to-edge
    NavigationBar.setBackgroundColorAsync("transparent");
    NavigationBar.setBehaviorAsync("overlay-swipe");
    NavigationBar.setButtonStyleAsync("light");
  }, []);

  const handleNext = () => {
    if (isLast) {
      router.push("/admin-welcome");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    router.push("/admin-welcome");
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    } else {
      if (router.canGoBack()) router.back();
      else router.replace("/(auth)/role-select");
    }
  };

  if (isLandscape) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#2A0406" }} edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1, flexDirection: "row", padding: 16, gap: 20, maxWidth: 900, alignSelf: "center", width: "100%" }}>
          {/* Left Column: Inset Image Card */}
          <View style={{ width: "42%", height: "100%", borderRadius: 20, overflow: "hidden", position: "relative" }}>
            <ImageBackground
              key={currentIndex}
              source={slide.image}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            >
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.15)" }]} />
            </ImageBackground>

            {/* Back Button */}
            <Pressable
              onPress={handleBack}
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                width: 38,
                height: 38,
                borderRadius: 19,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.6)",
                backgroundColor: "rgba(0,0,0,0.3)",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <ArrowLeft size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Right Column: Slide Text, Dots & Action Buttons */}
          <View style={{ flex: 1, justifyContent: "center", paddingVertical: 12, paddingRight: 8 }}>
            {/* Headline */}
            <Text
              style={{
                fontFamily: "Fraunces-SemiBold",
                fontSize: 24,
                lineHeight: 32,
                color: "#FFFFFF",
                marginBottom: 8,
              }}
            >
              {slide.headline}
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontFamily: "WorkSans_400Regular",
                fontSize: 14,
                lineHeight: 20,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 20,
              }}
            >
              {slide.subtitle}
            </Text>

            {/* Progress Dots */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {adminSlides.map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: 8,
                    width: i === currentIndex ? 36 : 8,
                    borderRadius: 4,
                    backgroundColor: i === currentIndex ? "#FFFFFF" : "#ABABAB",
                  }}
                />
              ))}
            </View>

            {/* Action Buttons */}
            {isLast ? (
              <Pressable
                onPress={handleNext}
                style={({ pressed }) => ({
                  width: "100%",
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#4A080C",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: "WorkSans_600SemiBold",
                    fontSize: 15,
                    color: "#FFFFFF",
                    letterSpacing: 0.2,
                  }}
                >
                  Get Started
                </Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Skip */}
                <Pressable
                  onPress={handleSkip}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 48,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.6)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: "WorkSans_600SemiBold",
                      fontSize: 15,
                      color: "#FFFFFF",
                      letterSpacing: 0.2,
                    }}
                  >
                    Skip
                  </Text>
                </Pressable>

                {/* Next */}
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#4A080C",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: "WorkSans_600SemiBold",
                      fontSize: 15,
                      color: "#FFFFFF",
                      letterSpacing: 0.2,
                    }}
                  >
                    Next
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ImageBackground
      key={currentIndex}
      source={slide.image}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      {/* Subtle top darkening */}
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.18)" }]}
      />

      {/* Dark overlay for text legibility across all slides */}
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.50)",
        }}
      />

      {/* Back button — top-left */}
      <Pressable
        onPress={handleBack}
        style={{
          position: "absolute",
          top: 56,
          left: 24,
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.5)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <ArrowLeft size={20} color="#FFFFFF" />
      </Pressable>

      {/* Bottom content */}
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingBottom: 48,
          paddingHorizontal: 24,
          width: "100%",
        }}
      >
        {/* Headline */}
        <Text
          style={{
            fontFamily: "Fraunces-SemiBold",
            fontSize: 32,
            lineHeight: 40,
            color: "#FFFFFF",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {slide.headline}
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            fontFamily: "WorkSans_400Regular",
            fontSize: 20,
            lineHeight: 28,
            color: "rgba(255,255,255,0.80)",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          {slide.subtitle}
        </Text>

        {/* Progress Dots */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 32,
          }}
        >
          {adminSlides.map((_, i) => (
            <View
              key={i}
              style={{
                height: 8,
                width: i === currentIndex ? 40 : 8,
                borderRadius: 4,
                backgroundColor: i === currentIndex ? "#FFFFFF" : "#ABABAB",
              }}
            />
          ))}
        </View>

        {/* Buttons Row — last slide: single full-width Get Started; others: Skip + Next */}
        {isLast ? (
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => ({
              width: "100%",
              height: 63,
              borderRadius: 31.5,
              backgroundColor: "#4A080C",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "WorkSans_600SemiBold",
                fontSize: 16,
                color: "#FFFFFF",
                letterSpacing: 0.2,
              }}
            >
              Get Started
            </Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", gap: 12 }}>
            {/* Skip — outlined white */}
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => ({
                flex: 1,
                height: 63,
                borderRadius: 31.5,
                borderWidth: 1,
                borderColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 16,
                  color: "#FFFFFF",
                  letterSpacing: 0.2,
                }}
              >
                Skip
              </Text>
            </Pressable>

            {/* Next — oxblood filled */}
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => ({
                flex: 1,
                height: 63,
                borderRadius: 31.5,
                backgroundColor: "#4A080C",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "WorkSans_600SemiBold",
                  fontSize: 16,
                  color: "#FFFFFF",
                  letterSpacing: 0.2,
                }}
              >
                Next
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}
