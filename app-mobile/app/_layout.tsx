import "../global.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import AppAlert from "@/shared/components/AppAlert";
import AppErrorBoundary from "@/shared/components/AppErrorBoundary";
import ConnectionFrame from "@/shared/components/ConnectionFrame";
import AnimatedBrandSplash from "@/shared/components/AnimatedBrandSplash";
import { StartupReadyContext } from "@/shared/components/StartupContext";
import * as SplashScreen from "expo-splash-screen";
import { isRunningInExpoGo } from "expo";
import { useAuthStore } from "@/stores/useAuthStore";
import SessionMonitor from "@/shared/components/SessionMonitor";

SplashScreen.preventAutoHideAsync();
let brandSplashShown = false;
if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ fade: false, duration: 0 });
}

export default function RootLayout() {
  const [showBrandSplash, setShowBrandSplash] = useState(!brandSplashShown);
  const [splashReady, setSplashReady] = useState(false);
  const nativeSplashHidden = useRef(false);
  const [animationFinished, setAnimationFinished] = useState(brandSplashShown);
  const [dataReady, setDataReady] = useState(false);
  const finishBrandSplash = useCallback(() => { brandSplashShown = true; setAnimationFinished(true); }, []);
  useEffect(() => {
    let active = true;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      // Restore the session here; the gear loading route owns data preloading.
      if (active) setDataReady(true);
    };
    const unsubscribe = useAuthStore.persist.onFinishHydration(start);
    if (useAuthStore.persist.hasHydrated()) start();
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { if (animationFinished && dataReady) setShowBrandSplash(false); }, [animationFinished, dataReady]);
  const [fontsLoaded, fontError] = useFonts({
    "InstrumentSans-Regular": require("../assets/fonts/InstrumentSans-Regular.ttf"),
    "InstrumentSans-Medium": require("../assets/fonts/InstrumentSans-Medium.ttf"),
    "InstrumentSans-SemiBold": require("../assets/fonts/InstrumentSans-SemiBold.ttf"),
    "InstrumentSans-Bold": require("../assets/fonts/InstrumentSans-Bold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      if (nativeSplashHidden.current) return;
      nativeSplashHidden.current = true;
      await SplashScreen.hideAsync();
      setSplashReady(true);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // keep native splash screen visible until fonts are ready
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <SessionMonitor />
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} onLayout={onLayoutRootView}>
          <StartupReadyContext.Provider value={!showBrandSplash}>
            <ConnectionFrame>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
                <Stack.Screen name="(auth)" options={{ animation: "none" }} />
                <Stack.Screen name="(customer)" options={{ animation: "none", gestureEnabled: false }} />
                <Stack.Screen name="(admin)" options={{ animation: "none", gestureEnabled: false }} />
                <Stack.Screen name="(staff)" options={{ animation: "none" }} />
              </Stack>
            </ConnectionFrame>
          </StartupReadyContext.Provider>
          {showBrandSplash && (
            <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
              <AnimatedBrandSplash ready={splashReady} onComplete={finishBrandSplash} />
              {animationFinished && !dataReady ? <View style={{ position: "absolute", bottom: 80, alignSelf: "center" }}><ActivityIndicator color="#FFFDF9" accessibilityLabel="Preparing your screen" /></View> : null}
            </View>
          )}
        </View>
        {/* Global branded alert — driven by alertEmitter, available everywhere */}
        <AppAlert />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
