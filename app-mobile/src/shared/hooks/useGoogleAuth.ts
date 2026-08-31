import { useState } from "react";
import { NativeModules } from "react-native";
import { API_BASE_URL } from "@/api/config";
import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";

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

  const setToken = useAuthStore((s) => s.setToken);
  const setEmailStore = useAuthStore((s) => s.setEmail);
  const setNameStore = useAuthStore((s) => s.setName);
  const setRoleStore = useAuthStore((s) => s.setRole);
  const setCreatedAt = useAuthStore((s) => s.setCreatedAt);

  const promptAsync = async () => {
    setError("");

    if (!hasNativeModule || !GoogleSignin) {
      setError("Google Sign-In requires a Development Build (npx expo run:android) and cannot run in Expo Go.");
      return;
    }

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut().catch(() => {});
      const response = await GoogleSignin.signIn();

      if (isCancelledResponse(response)) {
        return;
      }

      if (!isSuccessResponse(response)) {
        throw new Error("Google Sign-In failed. Please try again.");
      }

      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("Google Sign-In failed. No token received.");

      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, role: selectedRole }),
      });
      const rawText = await res.text();
      let data: any = {};
      try { data = JSON.parse(rawText); } catch {}
      if (!res.ok) throw new Error(data.error ?? "Google authentication failed.");

      setToken(data.token);
      setEmailStore(data.user.email);
      setNameStore(data.user.name ?? "");
      setRoleStore(data.user.role);
      setCreatedAt(data.user.createdAt ?? new Date().toISOString());

      if (data.user.role === "admin") router.replace("/(admin)/dashboard");
      else if (data.user.role === "staff") router.replace("/(staff)/dashboard");
      else router.replace("/(customer)/browse");
    } catch (e: any) {
      if (e.message?.includes("Network request failed") || e.name === "TypeError") {
        setError("Unable to connect to server. Please check your internet connection.");
      } else {
        setError(e.message ?? "Google Sign-In failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return { promptAsync, loading, error, disabled: !hasNativeModule };
}
