import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";
import { Text } from "@/shared/components/Typography";
import Svg, { Path, Circle as SvgCircle, Polygon } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/useAuthStore";
import { preloadStartupData } from "@/shared/services/startupData";
import { registerPushToken } from "@/shared/utils/pushNotifications";

// Circular toothed contour with a hollow centre, no square outer shape.
const OUTER_D = Array.from({ length: 48 }, (_, index) => {
  const angle = index * Math.PI / 24;
  const radius = index % 4 === 1 || index % 4 === 2 ? 38 : 33;
  return `${index ? "L" : "M"}${40 + Math.cos(angle) * radius} ${40 + Math.sin(angle) * radius}`;
}).join(" ") + " Z M40 16 A24 24 0 1 0 40 64 A24 24 0 1 0 40 16 Z";

// ─── Inner gear: 18-point star polygon scaled to 60x60 ────────────────────────
const INNER_POINTS =
  "60,30 46.91,36.16 52.98,49.28 39,45.59 35.21,59.54 26.87,47.72 " +
  "15,55.98 16.21,41.57 1.81,40.26 12,30 1.81,19.74 16.21,18.43 " +
  "15,4.02 26.87,12.28 35.21,0.46 39,14.41 52.98,10.72 46.91,23.84";

function GearSpinner() {
  const outer = useRef(new Animated.Value(0)).current;
  const inner = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const outerLoop = Animated.loop(
      Animated.timing(outer, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })
    );
    const innerLoop = Animated.loop(
      Animated.timing(inner, { toValue: 1, duration: 4500, easing: Easing.linear, useNativeDriver: true })
    );
    outerLoop.start();
    innerLoop.start();
    return () => { outerLoop.stop(); innerLoop.stop(); };
  }, [outer, inner]);

  const outerSpin = outer.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const innerSpin = inner.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={styles.spinner}>
      {/* Circle outline */}
      <Svg width={80} height={80} style={StyleSheet.absoluteFill}>
        <SvgCircle cx={40} cy={40} r={36} stroke="#453332" strokeWidth={7} fill="none" />
      </Svg>

      {/* Outer gear: mocha, slow (6s) */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: outerSpin }] }]}>
        <Svg width={80} height={80} viewBox="0 0 80 80">
          <Path d={OUTER_D} fill="#453332" fillRule="evenodd" />
        </Svg>
      </Animated.View>

      {/* Inner gear: tomato, fast (4.5s), offset right like CSS translate: 15.625% */}
      <Animated.View style={[styles.innerGear, { transform: [{ rotate: innerSpin }] }]}>
        <Svg width={60} height={60} viewBox="0 0 60 60">
          <Polygon points={INNER_POINTS} fill="#F96951" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─── Post-login prefetch screen ───────────────────────────────────────────────
export default function PostLoginLoading() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);
  const isVerified = useAuthStore((s) => s.isVerified);
  const onboardingCompleted = useAuthStore((s) => s.onboardingCompleted);
  const requiresPasswordChange = useAuthStore((s) => s.requiresPasswordChange);
  const navigated = useRef(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!token || !role) { router.replace("/(auth)/login"); return; }
      if (requiresPasswordChange) { router.replace({ pathname: "/(auth)/reset-password", params: { firstTimeStaff: "true", email } }); return; }
      if (navigated.current) return;
      void registerPushToken(token).catch(() => {});

      await preloadStartupData();
      if (!active || useAuthStore.getState().token !== token) return;

      if (navigated.current) return;
      navigated.current = true;

      if (role === "admin") {
        if (!isVerified) {
          router.replace({ pathname: "/(auth)/verify", params: { email } } as any);
        } else if (!onboardingCompleted) {
          router.replace("/(admin)/onboarding" as any);
        } else {
          router.replace("/(admin)/dashboard" as any);
        }
      } else if (role === "staff") {
        router.replace("/(staff)/dashboard" as any);
      } else {
        router.replace("/(customer)/browse" as any);
      }
    };

    void run();
    return () => { active = false; };
  }, [token, role, email, isVerified, onboardingCompleted, requiresPasswordChange]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <GearSpinner />
      <Text style={styles.label}>Getting things ready…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
  },
  spinner: {
    width: 80,
    height: 80,
  },
  innerGear: {
    position: "absolute",
    // Offset right ~15.625% of 60 ≈ 9.4px, centred vertically → top: 10, left: 19.4
    top: 10,
    left: 10,
  },
  label: {
    fontFamily: "InstrumentSans-Medium",
    fontSize: 15,
    color: "#453332",
    letterSpacing: 0.2,
  },
});

