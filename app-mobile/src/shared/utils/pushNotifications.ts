import { API_BASE_URL } from "@/api/config";

export async function registerPushToken(authToken: string) {
  try {
    const Notifications = require("expo-notifications");
    const Device = require("expo-device");

    if (!Device.isDevice) return;

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
