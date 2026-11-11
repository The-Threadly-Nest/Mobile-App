import React, { useState, useEffect } from "react";
import { View, Pressable, ImageBackground, StyleSheet, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavigationBar } from "expo-navigation-bar";
import { router } from "expo-router";

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
    NavigationBar.setStyle("dark");
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

  if (isLandscape) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#453332" }} edges={["top", "bottom", "left", "right"]}>
        <View style={{ flex: 1, flexDirection: "row", padding: 16, gap: 20, maxWidth: 900, alignSelf: "center", width: "100%" }}>
          {/* Left Column: Inset Image Card */}
          <View style={{ width: "42%", height: "100%", borderRadius: 20, overflow: "hidden", position: "relative" }}>
            <ImageBackground
              key={currentIndex}
              source={slide.image}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            >
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(43, 43, 43,0.15)" }]} />
            </ImageBackground>
          </View>

          {/* Right Column: Slide Text, Dots & Action Buttons */}
          <View style={{ flex: 1, justifyContent: "center", paddingVertical: 12, paddingRight: 8 }}>
            {/* Headline */}
            <Text
              style={{
                fontFamily: "InstrumentSans-Regular",
                fontSize: 24,
                lineHeight: 32,
                color: "#FFFDF9",
                marginBottom: 8,
              }}
            >
              {slide.headline}
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontFamily: "InstrumentSans-Regular",
                fontSize: 14,
                lineHeight: 20,
                color: "rgba(255, 255, 255,0.85)",
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
                    backgroundColor: i === currentIndex ? "#FFFDF9" : "#2B2B2B",
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
                  backgroundColor: "#F96951",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255,0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: "InstrumentSans-SemiBold",
                    fontSize: 15,
                    color: "#FFFDF9",
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
                    borderColor: "rgba(255, 255, 255,0.6)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: "InstrumentSans-SemiBold",
                      fontSize: 15,
                      color: "#FFFDF9",
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
                    backgroundColor: "#F96951",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: "InstrumentSans-SemiBold",
                      fontSize: 15,
                      color: "#FFFDF9",
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
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(43, 43, 43,0.18)" }]}
      />

      {/* Dark overlay for text legibility across all slides */}
      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(43, 43, 43,0.50)",
        }}
      />

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
            fontFamily: "InstrumentSans-Regular",
            fontSize: 32,
            lineHeight: 40,
            color: "#FFFDF9",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          {slide.headline}
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            fontFamily: "InstrumentSans-Regular",
            fontSize: 20,
            lineHeight: 28,
            color: "rgba(255, 255, 255,0.80)",
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
                backgroundColor: i === currentIndex ? "#FFFDF9" : "#2B2B2B",
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
              backgroundColor: "#F96951",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "InstrumentSans-SemiBold",
                fontSize: 16,
                color: "#FFFDF9",
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
                borderColor: "#FFFDF9",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "InstrumentSans-SemiBold",
                  fontSize: 16,
                  color: "#FFFDF9",
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
                backgroundColor: "#F96951",
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "InstrumentSans-SemiBold",
                  fontSize: 16,
                  color: "#FFFDF9",
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
