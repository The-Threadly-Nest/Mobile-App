import { prisma } from "./prisma";

export async function sendNotificationToUser(userId: string, title: string, body: string, data?: any) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    if (!user?.pushToken) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
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
