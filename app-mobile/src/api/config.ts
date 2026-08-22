import { Platform } from "react-native";
import Constants from "expo-constants";

const getDevServerIp = () => {
  // Dynamically extract the computer's Wi-Fi IP address from Expo Go host URI
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:4000`;
    }
  }
  // Fallback to computer's local Wi-Fi IP
  return "http://192.168.0.178:4000";
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || getDevServerIp();
