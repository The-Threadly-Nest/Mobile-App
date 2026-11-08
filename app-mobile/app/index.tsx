import React, { useEffect, useRef, useCallback } from "react";
import { View, Text, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { apiFetch, ApiError } from "@/shared/utils/apiClient";
import { registerPushToken } from "@/shared/utils/pushNotifications";

export default function VideoSplashScreen() {
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

  // Preload role data and configure status bar for logged-in users
  useEffect(() => {
    const fetchSafe = async (endpoint: string) => {
      try {
        return await apiFetch<any>(endpoint, { silent: true });
      } catch (error) {
        return null;
      }
    };

    const preloadData = async () => {
      if (!token || !role) return;
      try {
        const appStore = useAppDataStore.getState();
        appStore.activateCache(`${role}:${email.trim().toLowerCase()}`);

        if (role === "admin") {
          const [orders, staff, escalations] = await Promise.all([
            fetchSafe("/api/orders?page=1&limit=30"),
            fetchSafe("/api/staff"),
            fetchSafe("/api/escalations?limit=20"),
          ]);
          if (Array.isArray(orders)) appStore.setOrders(orders);
          if (Array.isArray(staff)) appStore.setStaffList(staff);
          if (Array.isArray(escalations)) appStore.setEscalations(escalations);
        } else if (role === "staff") {
          const [orders, profile] = await Promise.all([
            fetchSafe("/api/orders?page=1&limit=30"),
            fetchSafe("/api/staff/me"),
          ]);
          if (Array.isArray(orders)) appStore.setOrders(orders);
          if (profile) appStore.setProfile(profile);
        } else {
          const [myOrders, catalog] = await Promise.all([
            fetchSafe("/api/orders/my-orders"),
            fetchSafe("/api/fashion-houses"),
          ]);
          if (Array.isArray(myOrders)) appStore.setOrders(myOrders);
          if (Array.isArray(catalog)) appStore.setCatalogItems(catalog);
        }
        appStore.setLastSyncedAt(Date.now());
      } catch (e) {
        console.warn("[Splash] Preload warning:", e);
      }
    };

    preloadData();
  }, [token, role, email]);

  // Auto-navigate if already authenticated
  useEffect(() => {
    if (token && role) {
      void (async () => {
        try {
          await registerPushToken(token);
        } catch {}
        if (role === "admin") {
          if (!isVerified) {
            router.replace({ pathname: "/(auth)/verify", params: { email } });
          } else if (!onboardingCompleted) {
            router.replace("/(admin)/onboarding");
          } else {
            router.replace("/(admin)/dashboard");
          }
        } else if (role === "staff") {
          router.replace("/(staff)/dashboard");
        } else {
          router.replace("/(customer)/browse");
        }
      })();
    }
  }, [token, role, isVerified, onboardingCompleted, email]);

  const handleGetStarted = () => {
    router.push("/(auth)/signup");
  };

  const handleLogIn = () => {
    router.push("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Fullscreen Video */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Cinematic Gradient Scrim Overlay */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#1A1110" stopOpacity="0.2" />
            <Stop offset="40%" stopColor="#1A1110" stopOpacity="0.4" />
            <Stop offset="65%" stopColor="#1A1110" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#1A1110" stopOpacity="0.95" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1110",
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
    fontFamily: "HedvigLettersSerif-Regular",
    fontSize: 26,
    lineHeight: 34,
    color: "#FBF7EF",
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
    shadowColor: "#000",
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
    color: "#FBF7EF",
  },
  loginBold: {
    fontFamily: "InstrumentSans-SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
});
