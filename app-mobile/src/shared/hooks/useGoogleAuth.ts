import { useRef, useState } from "react";
import { NativeModules } from "react-native";
import { apiFetch } from "@/shared/utils/apiClient";
import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";
import { registerPushToken } from "@/shared/utils/pushNotifications";

// Dynamically import Google Sign-In to prevent crashing in Expo Go
let GoogleSignin: any = null;
let isSuccessResponse: any = null;
let isCancelledResponse: any = null;

const hasNativeModule = !!NativeModules.RNGoogleSignin;

if (hasNativeModule) {
  try {
    const googleModule = require("@react-native-google-signin/google-signin");
    GoogleSignin = googleModule.GoogleSignin;
    isSuccessResponse = googleModule.isSuccessResponse;
    isCancelledResponse = googleModule.isCancelledResponse;

    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    });
  } catch (e) {
    console.warn("Google Sign-In initialization failed:", e);
  }
}

export function useGoogleAuth(selectedRole: "customer" | "admin" = "customer") {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const signInBusy = useRef(false);

  const setSession = useAuthStore((s) => s.setSession);

  const promptAsync = async () => {
    if (signInBusy.current) return;
    setError("");

    if (!hasNativeModule || !GoogleSignin) {
      setError("Google Sign-In requires a Development Build (npx expo run:android) and cannot run in Expo Go.");
      return;
    }

    signInBusy.current = true;
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      // Clear the SDK's remembered account, not the person's Owuja session.
      // Interactive sign-in must offer account selection instead of auto-reusing it.
      await GoogleSignin.signOut();
      const response = await GoogleSignin.signIn();

      if (isCancelledResponse(response)) {
        return;
      }

      if (!isSuccessResponse(response)) {
        throw new Error("Google Sign-In failed. Please try again.");
      }

      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("Google Sign-In failed. No token received.");

      const data = await apiFetch<any>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken, role: selectedRole }),
      });

      const userVerified = data.user.isVerified ?? true;
      const userOnboardingCompleted = data.user.onboardingCompleted ?? false;

      setSession({
        userId: data.user.id,
        token: data.token,
        email: data.user.email,
        name: data.user.name ?? "",
        shopName: data.user.shopName ?? "",
        role: data.user.role,
        createdAt: data.user.createdAt ?? new Date().toISOString(),
        isVerified: userVerified,
        onboardingCompleted: userOnboardingCompleted,
      });

      // Register push token asynchronously after Google Sign-In
      registerPushToken(data.token).catch((err) =>
        console.warn("[GoogleAuth] Push token registration failed:", err)
      );

      if (data.user.role === "admin") {
        if (!userOnboardingCompleted) {
          router.replace("/(admin)/onboarding");
        } else {
          router.replace("/(admin)/dashboard");
        }
      } else if (data.user.role === "staff") router.replace("/(staff)/dashboard");
      else router.replace("/(customer)/browse");
    } catch (e: any) {
      if (e.message?.includes("Network request failed") || e.name === "TypeError") {
        setError("Unable to connect to server. Please check your internet connection.");
      } else {
        setError(e.message ?? "Google Sign-In failed. Please try again.");
      }
    } finally {
      signInBusy.current = false;
      setLoading(false);
    }
  };

  return { promptAsync, loading, error, disabled: !hasNativeModule };
}
