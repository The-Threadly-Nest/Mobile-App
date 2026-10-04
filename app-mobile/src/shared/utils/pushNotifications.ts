import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { API_BASE_URL } from "@/api/config";
import { alertEmitter } from "./alertEmitter";
import { router } from "expo-router";
import { useAuthStore } from "@/stores/useAuthStore";

let notificationListener: any = null;
let notificationResponseListener: any = null;

async function handleMessageAction(response: any) {
  const actionId = response.actionIdentifier;
  const content = response.notification.request.content;
  const data = content.data ?? {};
  const threadId = data.customerId || data.fashionHouseId;
  const token = useAuthStore.getState().token;
  if (!threadId || !token) return;

  const threadUrl = `${API_BASE_URL}/api/direct-messages/thread/${encodeURIComponent(String(threadId))}`;
  if (actionId === "REPLY") {
    const replyText = response.userText?.trim();
    if (!replyText) return;
    await fetch(threadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: replyText }),
    });
    return;
  }
  if (actionId === "MARK_READ") {
    await fetch(`${threadUrl}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    return;
  }

  if (data.screen === "messages") {
    router.push({ pathname: "/(admin)/messages", params: { customerId: String(data.customerId ?? "") } } as any);
  } else if (data.screen === "direct-chat" && data.fashionHouseId) {
    router.push(`/(customer)/direct-chat/${data.fashionHouseId}` as any);
  }
}

/**
 * Configure Expo Notifications foreground presentation, Android channels, and listeners.
 */
export async function initNotifications() {
  try {
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) return;

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

    await Notifications.setNotificationCategoryAsync("message", [
      {
        identifier: "REPLY",
        buttonTitle: "Reply",
        options: { opensAppToForeground: false },
        textInput: { submitButtonTitle: "Send", placeholder: "Message" },
      },
      {
        identifier: "MARK_READ",
        buttonTitle: "Mark as read",
        options: { opensAppToForeground: false },
      },
    ]);

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
    if (!notificationResponseListener) {
      notificationResponseListener = Notifications.addNotificationResponseReceivedListener((response: any) => {
        handleMessageAction(response).catch((error) => {
          console.warn("[notification] Message action failed:", error);
        });
      });

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) void handleMessageAction(lastResponse);
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
    // Expo Go does not support custom push tokens — standalone/internal builds only
    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) return;

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
    if (finalStatus !== "granted") {
      console.warn("[pushToken] Notification permission not granted.");
      return;
    }

    // Expo SDK 49+ requires projectId to be passed explicitly
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("[pushToken] No EAS projectId found in app config.");
      return;
    }

    const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
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
    console.warn("[pushToken] Push notification registration failed:", e);
  }
}
