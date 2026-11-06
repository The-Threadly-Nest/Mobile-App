import React, { useEffect, useRef, useCallback } from "react";
import { View, Image, Pressable, Animated, StyleSheet } from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/useAuthStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { ApiError, apiFetch } from "@/shared/utils/apiClient";
import { NavigationBar } from "expo-navigation-bar";
import { registerPushToken } from "@/shared/utils/pushNotifications";

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const isVerified = useAuthStore((state) => state.isVerified);
  const onboardingCompleted = useAuthStore((state) => state.onboardingCompleted);
  const email = useAuthStore((state) => state.email);

  const hasNavigatedRef = useRef(false);
  const isUnauthorizedRef = useRef(false);
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  // Gentle breathing pulse animation for "Tap to continue"
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseOpacity]);

  // Preload role data and configure status/navigation bars
  useEffect(() => {
    NavigationBar.setStyle("light");

    const fetchSafe = async (endpoint: string) => {
      try {
        return await apiFetch<any>(endpoint, { silent: true });
      } catch (error) {
        if (error instanceof ApiError && error.details.status === 401) {
          isUnauthorizedRef.current = true;
        }
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

  // Navigation transition
  const handleContinue = useCallback(async () => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    const currentToken = useAuthStore.getState().token;
    const currentRole = useAuthStore.getState().role;
    const currentIsVerified = useAuthStore.getState().isVerified;
    const currentOnboarding = useAuthStore.getState().onboardingCompleted;
    const currentEmail = useAuthStore.getState().email;

    if (currentToken && currentRole && !isUnauthorizedRef.current) {
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
  }, []);

  return (
    <Pressable onPress={handleContinue} style={styles.container}>
      <StatusBar style="light" />

      {/* Optical Center: Owuja Logo (Node 95:8800) */}
      <View style={styles.logoWrapper}>
        <Image
          source={require("../assets/splash-logo.png")}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Owuja Logo"
        />
      </View>

      {/* Bottom Action: Tap to continue (Node 95:8801) */}
      <View style={[styles.bottomWrapper, { paddingBottom: Math.max(insets.bottom + 16, 44) }]}>
        <Animated.Text style={[styles.tapText, { opacity: pulseOpacity }]}>
          Tap to continue
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#453332",
    justifyContent: "center",
    alignItems: "center",
  },
  logoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 200,
    height: 63,
  },
  bottomWrapper: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  tapText: {
    fontFamily: "InstrumentSans-Regular",
    fontSize: 16,
    lineHeight: 20,
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0,
  },
});
