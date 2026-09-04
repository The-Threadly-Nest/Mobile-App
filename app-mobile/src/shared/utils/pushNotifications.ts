import { Platform } from "react-native";
import { API_BASE_URL } from "@/api/config";
import { alertEmitter } from "./alertEmitter";

let notificationListener: any = null;

/**
 * Configure Expo Notifications foreground presentation, Android channels, and listeners.
 */
export async function initNotifications() {
  try {
    const Notifications = require("expo-notifications");

    // 1. Configure foreground notification handler so alerts/sounds/badges show while app is open
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // 2. Setup Android high-priority channel with custom brand colors & vibration
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Threadly Nest Notifications",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#D97706",
        sound: "default",
      });
    }

    // 3. Listen for foreground notifications and trigger branded alert modal
    if (!notificationListener) {
      notificationListener = Notifications.addNotificationReceivedListener((notification: any) => {
        const { title, body } = notification.request.content;
        if (title || body) {
          alertEmitter.emit({
            title: title || "Notification",
            message: body || "",
          });
        }
      });
    }
  } catch (e) {
    console.warn("[initNotifications] Failed to initialize notification handlers:", e);
  }
}

/**
 * Register device push token with backend server
 */
export async function registerPushToken(authToken: string) {
  try {
    const Notifications = require("expo-notifications");
    const Device = require("expo-device");

    if (!Device.isDevice) return;

    // Initialize handlers & channels
    await initNotifications();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return;

    const pushTokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = pushTokenData.data;

    if (pushToken && authToken) {
      await fetch(`${API_BASE_URL}/api/auth/push-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pushToken }),
      });
    }
  } catch (e) {
    console.warn("[pushToken] Push notification registration skipped or unavailable:", e);
  }
}
