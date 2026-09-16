import { prisma } from "./prisma";

export async function sendNotificationToUser(userId: string, title: string, body: string, data?: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user?.pushToken) {
      console.log(`[push-notification] Skipped — no pushToken for user ${userId}`);
      return;
    }

    console.log(`[push-notification] Sending to user ${userId}: "${title}"`);

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
        data,
      }),
    });

    const json = await res.json() as any;
    const ticket = json?.data?.[0];
    if (ticket?.status === "error") {
      console.warn("[push-notification] Expo delivery error:", ticket.message, ticket.details);
      // Stale/unregistered token — clear it so future sends don't keep failing silently
      if (ticket.details?.error === "DeviceNotRegistered") {
        console.warn(`[push-notification] Clearing stale pushToken for user ${userId}`);
        await prisma.user.update({ where: { id: userId }, data: { pushToken: null } });
      }
    } else {
      console.log(`[push-notification] Delivered successfully to user ${userId}`);
    }
  } catch (err) {
    console.warn("[push-notification] Failed to send push notification:", err);
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
    console.warn("[push-notification] Failed to send admin push notification:", err);
  }
}
