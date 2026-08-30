import "../global.css";
import { useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold,
} from "@expo-google-fonts/work-sans";
import * as SplashScreen from "expo-splash-screen";

SplashScreen.preventAutoHideAsync();

/**
 * Fraunces is NOT on Expo's pre-packaged Google Fonts list the way
 * Work Sans is, so it's loaded manually from local .ttf files.
 * Download the weights you need from fonts.google.com/specimen/Fraunces
 * and drop them in assets/fonts/ — see README "Font Setup" section.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold,
    "Fraunces-Bold": require("../assets/fonts/Fraunces-Bold.ttf"),
    "Fraunces-SemiBold": require("../assets/fonts/Fraunces-Bold.ttf"),
    "Fraunces-Regular": require("../assets/fonts/Fraunces-Regular.ttf"),
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
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </SafeAreaProvider>
  );
}
