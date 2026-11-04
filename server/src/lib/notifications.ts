import { identityPrisma as prisma } from "./prisma";
import { appLogger, logFailure } from "../core/logging";

export async function sendNotificationToUser(userId: string, title: string, body: string, data?: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) {
      appLogger.debug("Notification skipped because this account has no registered device.");
      return;
    }

    appLogger.debug("Sending a notification to the account's registered device.");

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        to: user.pushToken,
        sound: "default",
        title,
        body,
        categoryId: data?.screen === "messages" || data?.screen === "direct-chat" ? "message" : undefined,
        data,
      }),
    });

    if (!res.ok) throw new Error(`Notification provider returned HTTP ${res.status}`);
    const json = await res.json() as any;
    const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
    if (!ticket || !["ok", "error"].includes(ticket.status)) throw new Error("Notification provider returned an unexpected response");
    if (ticket?.status === "error") {
      appLogger.warn("The notification provider did not accept the notification. Delivery settings may need attention.");
      // Stale/unregistered token — clear it so future sends don't keep failing silently
      if (ticket.details?.error === "DeviceNotRegistered") {
        appLogger.warn("The registered notification device is no longer available. Its old registration is being cleared.");
        await prisma.user.updateMany({ where: { id: userId, pushToken: user.pushToken }, data: { pushToken: null } });
      }
    } else {
      appLogger.debug("The notification provider accepted the notification for delivery.");
    }
  } catch (err) {
    logFailure("The notification could not be sent.", err);
  }
}

export async function sendNotificationToAdmin(fashionHouseId: string, title: string, body: string, data?: any) {
  try {
    const fh = await prisma.fashionHouse.findUnique({
      where: { id: fashionHouseId },
      select: { adminId: true },
    });
    if (fh?.adminId) {
      await sendNotificationToUser(fh.adminId, title, body, data);
    }
  } catch (err) {
    logFailure("The fashion house owner could not be notified.", err);
  }
}
