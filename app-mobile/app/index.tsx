import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { ApiError, apiFetch } from "@/shared/utils/apiClient";
import { NavigationBar } from "expo-navigation-bar";
import { registerPushToken } from "@/shared/utils/pushNotifications";

export default function SplashScreen() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const isVerified = useAuthStore((state) => state.isVerified);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  const email = useAuthStore((state) => state.email);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    NavigationBar.setStyle("light");

    let isUnauthorized = false;

    // Helper to fetch with 401 handling
    const fetchSafe = async (endpoint: string) => {
      try {
        return await apiFetch<any>(endpoint, { silent: true });
      } catch (error) {
        if (error instanceof ApiError && error.details.status === 401) {
          isUnauthorized = true;
        }
        return null;
      }
    };

    // Preload role-based application data into local device storage during splash screen
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

    // Animate progress bar from 0% to 100% over 4 seconds
    Animated.timing(progress, {
      toValue: 1,
      duration: 4000,
      useNativeDriver: false, // width animation requires layout reflow
    }).start(async () => {
      const currentToken = useAuthStore.getState().token;
      const currentRole = useAuthStore.getState().role;
      const currentIsVerified = useAuthStore.getState().isVerified;
      const currentOnboarding = useAuthStore.getState().onboardingCompleted;
      const currentEmail = useAuthStore.getState().email;

      // Navigate once the progress bar is completely filled
      if (currentToken && currentRole && !isUnauthorized) {
        await registerPushToken(currentToken);
        if (currentRole === "admin") {
          if (!currentIsVerified) {
            router.replace({ pathname: "/(auth)/verify", params: { email: currentEmail } });
          } else if (!currentOnboarding) {
            router.replace("/(admin)/onboarding");
          } else {
            router.replace("/(admin)/dashboard");
          }
        } else if (currentRole === "staff") {
          router.replace("/(staff)/dashboard");
        } else {
          router.replace("/(customer)/browse");
        }
      } else {
        router.replace("/(auth)/role-select");
      }
    });
  }, [token, role, isVerified, onboardingCompleted, email]);

  const fillWidth = "0%" as const;
  const spin = "0deg" as const;

  return (
    <View style={{ flex: 1, backgroundColor: "#F96951", alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="light" />
      {/* Main Content Container */}
      <View className="items-center justify-center gap-6">

        {/* Circle Logo Container */}
        <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>

          {/* Spinning outer dotted circle */}
          <Animated.View
            style={{
              display: "none",
              position: "absolute",
              left: 0,
              top: 0,
              width: 200,
              height: 200,
              transform: [{ rotate: spin }],
            }}
          >
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <Circle
                cx={100}
                cy={100}
                r={98}
                stroke="#C4A763"
                strokeWidth={2}
                strokeDasharray={[2, 6]}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
          </Animated.View>

          {/* Static inner solid circle */}
          <Svg
            width={200}
            height={200}
            viewBox="0 0 200 200"
            style={{ position: "absolute", left: 0, top: 0, display: "none" }}
          >
            <Circle
              cx={100}
              cy={100}
              r={80}
              stroke="#C4A763"
              strokeWidth={2}
              fill="none"
            />
          </Svg>

          <Image
            source={require("../assets/splash-icon-dark.png")}
            style={{ width: 200, height: 200 }}
            resizeMode="contain"
          />
        </View>

        {/* Text and progress wrapper — full screen width so text-center is relative to screen */}
        <View style={{ width: "100%", alignItems: "center", gap: 36 }}>
          {/* Text wrapper */}
          <View style={{ width: "100%", alignItems: "center", gap: 8 }}>
            {/* The Threadly Nest */}
            <Text
              style={{
                width: "100%",
                textAlign: "center",
                fontFamily: "InstrumentSans-Regular",
                fontSize: 44,
                lineHeight: 52,
                color: "#FFFFFF",
                includeFontPadding: false,
              }}
            >
              Owuja
            </Text>
            {/* Tagline */}
            <Text
              style={{ display: "none", width: "100%", textAlign: "center", letterSpacing: 1.5 }}
              className="font-body-semibold text-[11px] text-gold uppercase"
            >
              A HUB FOR FASHION.
            </Text>
          </View>

          {/* Progress bar track */}
          <View
            style={{ display: "none", backgroundColor: "rgba(196, 167, 99, 0.25)", width: 200, height: 4, borderRadius: 36, overflow: "hidden" }}
          >
            {/* Progress bar fill */}
            <Animated.View
              style={{ width: fillWidth, height: "100%", backgroundColor: "#C4A763", borderRadius: 36 }}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
