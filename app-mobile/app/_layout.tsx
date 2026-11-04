import "../global.css";
import { useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import AppAlert from "@/shared/components/AppAlert";
import AppErrorBoundary from "@/shared/components/AppErrorBoundary";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "InstrumentSans-Regular": require("../assets/fonts/InstrumentSans-Regular.ttf"),
    "InstrumentSans-Medium": require("../assets/fonts/InstrumentSans-Medium.ttf"),
    "InstrumentSans-SemiBold": require("../assets/fonts/InstrumentSans-SemiBold.ttf"),
    "InstrumentSans-Bold": require("../assets/fonts/InstrumentSans-Bold.ttf"),
    "HedvigLettersSerif-Regular": require("../assets/fonts/HedvigLettersSerif-Regular.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null; // keep native splash screen visible until fonts are ready
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <Stack screenOptions={{ headerShown: false }} />
        </View>
        {/* Global branded alert — driven by alertEmitter, available everywhere */}
        <AppAlert />
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
