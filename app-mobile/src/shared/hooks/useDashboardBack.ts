import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

// The dashboard is the signed-in navigation root, never a route back to signup/video.
export function useDashboardBack() {
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      BackHandler.exitApp();
      return true;
    });
    return () => subscription.remove();
  }, []));
}
