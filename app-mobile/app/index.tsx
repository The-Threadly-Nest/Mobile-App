import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
import { router } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { API_BASE_URL } from "@/api/config";
import * as NavigationBar from "expo-navigation-bar";
import { registerPushToken } from "@/shared/utils/pushNotifications";

export default function SplashScreen() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const isVerified = useAuthStore((state) => state.isVerified);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  const email = useAuthStore((state) => state.email);
  const progress = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Match Android nav bar to oxblood splash background
    NavigationBar.setBackgroundColorAsync("#4A080C");
    NavigationBar.setButtonStyleAsync("light");

    // Spin the outer dotted circle continuously
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Preload role-based application data into local device storage during splash screen
    const preloadData = async () => {
      if (!token || !role) return;
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const appStore = useAppDataStore.getState();

        if (role === "admin") {
          await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/orders?page=1&limit=30`, { headers })
              .then((r) => r.json())
              .then((data) => Array.isArray(data) && appStore.setOrders(data)),
            fetch(`${API_BASE_URL}/api/staff`, { headers })
              .then((r) => r.json())
              .then((data) => Array.isArray(data) && appStore.setStaffList(data)),
            fetch(`${API_BASE_URL}/api/escalations?limit=20`, { headers })
              .then((r) => r.json())
              .then((data) => Array.isArray(data) && appStore.setEscalations(data)),
          ]);
        } else if (role === "staff") {
          await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/orders?page=1&limit=30`, { headers })
              .then((r) => r.json())
              .then((data) => Array.isArray(data) && appStore.setOrders(data)),
            fetch(`${API_BASE_URL}/api/staff/me`, { headers })
              .then((r) => r.json())
              .then((data) => appStore.setProfile(data)),
          ]);
        } else {
          await Promise.allSettled([
            fetch(`${API_BASE_URL}/api/orders/my-orders`, { headers })
              .then((r) => r.json())
              .then((data) => Array.isArray(data) && appStore.setOrders(data)),
            fetch(`${API_BASE_URL}/api/fashion-houses`, { headers })
              .then((r) => r.json())
              .then((data) => Array.isArray(data) && appStore.setCatalogItems(data)),
          ]);
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
    }).start(() => {
      // Navigate once the progress bar is completely filled
      if (token && role) {
        registerPushToken(token);
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
      } else {
        router.replace("/(auth)/role-select");
      }
    });
  }, [token, role, isVerified, onboardingCompleted, email]);

  // Interpolate progress value to percentage width
  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  // Interpolate rotation value to degrees
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View className="flex-1 bg-oxblood items-center justify-center">
      {/* Main Content Container */}
      <View className="items-center justify-center gap-6">

        {/* Circle Logo Container */}
        <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>

          {/* Spinning outer dotted circle */}
          <Animated.View
            style={{
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
            style={{ position: "absolute", left: 0, top: 0 }}
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

          {/* TTN Text inside the inner circle */}
          <Text
            style={{
              letterSpacing: 2,
              paddingLeft: 2,
              includeFontPadding: false,
              textAlignVertical: "center",
            }}
            className="font-display text-[48px] text-gold uppercase text-center"
          >
            TTN
          </Text>
        </View>

        {/* Text and progress wrapper — full screen width so text-center is relative to screen */}
        <View style={{ width: "100%", alignItems: "center", gap: 36 }}>
          {/* Text wrapper */}
          <View style={{ width: "100%", alignItems: "center", gap: 8 }}>
            {/* The Threadly Nest */}
            <Text
              style={{ width: "100%", textAlign: "center" }}
              className="font-display-regular text-[24px] text-white"
            >
              The Threadly Nest
            </Text>
            {/* Tagline */}
            <Text
              style={{ width: "100%", textAlign: "center", letterSpacing: 1.5 }}
              className="font-body-semibold text-[11px] text-gold uppercase"
            >
              A HUB FOR FASHION.
            </Text>
          </View>

          {/* Progress bar track */}
          <View
            style={{ backgroundColor: "rgba(196, 167, 99, 0.25)", width: 200, height: 4, borderRadius: 36, overflow: "hidden" }}
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
