import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ImageBackground,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";

const slides = [
  {
    image: require("../assets/onboarding-1.png"),
    headline: "Find the right tailor,\nfirst time.",
    subtitle: "Discover trusted fashion houses across Nigeria.",
  },
  {
    image: require("../assets/onboarding-2.png"),
    headline: "Book a fitting in\nminutes.",
    subtitle: "Answer a few questions and secure your appointment. No back-and-forth.",
  },
  {
    image: require("../assets/onboarding-3.png"),
    headline: "Track your outfit\nevery step.",
    subtitle: "See real progress, photos, and delivery dates.",
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      router.replace("/(auth)/welcome");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleSkip = () => {
    router.replace("/(auth)/welcome");
  };

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

      {/* Bottom content */}
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingBottom: 48,
          paddingHorizontal: 24,
        }}
      >
        {/* Headline */}
        <Text
          style={{
            fontFamily: "Fraunces-Bold",
            fontSize: 36,
            lineHeight: 44,
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
            fontSize: 16,
            lineHeight: 24,
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
          {slides.map((_, i) => (
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
          /* Get Started — full width oxblood */
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => ({
              width: "100%",
              height: 63,
              borderRadius: 31,
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
                borderRadius: 31,
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
                borderRadius: 31,
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
