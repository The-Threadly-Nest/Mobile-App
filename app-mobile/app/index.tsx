import React, { useEffect, useRef, useCallback, useState } from "react";
import { View, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Text } from "@/shared/components/Typography";
import { router, Redirect, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { apiFetch, ApiError } from "@/shared/utils/apiClient";
import { registerPushToken } from "@/shared/utils/pushNotifications";
import { useStartupReady } from "@/shared/components/StartupContext";

export default function VideoSplashScreen() {
  const ready = useStartupReady();
  const focused = usePathname() === "/";
  const token = useAuthStore(state => state.token);
  const role = useAuthStore(state => state.role);
  // The welcome route stays mounted behind login. Only the focused route may
  // redirect, otherwise setting the login session triggers two navigations.
  if (!ready || !focused) return null;
  if (token && role) return <Redirect href="/(auth)/loading" />;
  return <VideoWelcomeScreen />;
}

function VideoWelcomeScreen() {
  const [videoReady, setVideoReady] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const isVerified = useAuthStore((state) => state.isVerified);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  const email = useAuthStore((state) => state.email);

  // Background looping video setup
  const videoSource = require("../assets/splashscreen.mp4");
  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });



  const handleGetStarted = () => {
    router.push("/(auth)/signup");
  };

  const handleLogIn = () => {
    router.push("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <StatusBar style={videoReady ? "light" : "dark"} />

      {/* Fullscreen Video */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        onFirstFrameRender={() => setVideoReady(true)}
      />

      {/* Cinematic Gradient Scrim Overlay */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#2B2B2B" stopOpacity="0.5" />
            <Stop offset="12%" stopColor="#2B2B2B" stopOpacity="0.2" />
            <Stop offset="40%" stopColor="#2B2B2B" stopOpacity="0.4" />
            <Stop offset="65%" stopColor="#2B2B2B" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#2B2B2B" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
      </Svg>

      {/* Content Container (Bottom Aligned) */}
      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}
      >
        {/* Brand Section — Positioned right above Get Started */}
        <View style={styles.brandSection}>
          <Image
            source={require("../assets/logo-horizontal-mixed.png")}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Owuja Logo"
          />
          <Text style={styles.brandTagline}>Where thread meets the market.</Text>
        </View>

        {/* Bottom Actions */}
        <View style={styles.actionSection}>
          <Pressable
            onPress={handleGetStarted}
            style={({ pressed }) => [styles.getStartedBtn, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </Pressable>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Pressable onPress={handleLogIn} hitSlop={8}>
              <Text style={styles.loginBold}>Log In</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {!videoReady ? <View style={styles.videoLoadingCover}>
        <View style={styles.loadingBrand}>
          <Image source={require("../assets/splash-icon-black.png")} style={styles.loadingMark} resizeMode="contain" />
          <Text style={styles.loadingName}>Owuja</Text>
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  videoLoadingCover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" },
  loadingBrand: { flexDirection: "row", alignItems: "center", gap: 14 },
  loadingMark: { width: 64, height: 73.02 },
  loadingName: { fontFamily: "InstrumentSans-Medium", fontSize: 36, lineHeight: 44, color: "#FFFFFF" },
  container: {
    flex: 1,
    backgroundColor: "#2B2B2B",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 26,
  },
  brandSection: {
    marginBottom: 24,
  },
  brandLogo: {
    width: 190,
    height: 60,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  brandTagline: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 26,
    lineHeight: 34,
    color: "#FFFFFF",
    marginBottom: 8,
  },
  actionSection: {
    gap: 16,
    alignItems: "center",
  },
  getStartedBtn: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F96951",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2B2B2B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedText: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 14,
    color: "#FFFFFF",
  },
  loginBold: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
});
