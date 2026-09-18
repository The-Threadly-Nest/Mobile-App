import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { sendNotificationToUser, sendNotificationToAdmin } from "../lib/notifications";

const router = Router();
router.use(requireAuth);

// Helper: resolve the fashionHouseId and customerId for a thread
async function resolveThread(authUserId: string, paramFhId: string) {
  const user = await prisma.user.findUnique({ where: { id: authUserId } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 401 });

  if (user.role === "admin") {
    // Admin's own fashion house
    const fh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
    if (!fh) throw Object.assign(new Error("Fashion house not found for admin"), { status: 404 });
    // Admin views a specific customer thread by customerId passed in paramFhId? No —
    // For admin-initiated, paramFhId is the customerId they want to chat with.
    return { fashionHouseId: fh.id, customerId: paramFhId, senderRole: "admin" as const, senderId: user.id };
  }

  // Customer
  return { fashionHouseId: paramFhId, customerId: user.id, senderRole: "customer" as const, senderId: user.id };
}

// GET /api/direct-messages/thread/:fashionHouseId
// Customer: loads their thread with that fashion house
// Admin: paramFhId is treated as the customerId — loads that customer's thread
router.get("/thread/:fashionHouseId", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(req.authUserId!, req.params.fashionHouseId);

    const threadState = await prisma.directMessageThreadState.findUnique({
      where: {
        userId_fashionHouseId_customerId: {
          userId: req.authUserId!,
          fashionHouseId,
          customerId,
        },
      },
    });

    const messages = await prisma.directMessage.findMany({
      where: {
        fashionHouseId,
        customerId,
        ...(threadState ? { createdAt: { gt: threadState.clearedAt } } : {}),
        userDeletions: { none: { userId: req.authUserId! } },
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    // Mark unread messages sent to this user as read
    await prisma.directMessage.updateMany({
      where: {
        fashionHouseId,
        customerId,
        senderId: { not: req.authUserId! },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    // Attach the AI chat transcript from the latest escalation or chatSession for this thread
    // so both customer and admin can see the prior AI conversation history
    let transcript: unknown[] = [];
    try {
      const escalation = await prisma.chatEscalation.findFirst({
        where: { fashionHouseId, customerId },
        orderBy: { createdAt: "desc" },
      });
      if (escalation?.transcript && (!threadState || escalation.createdAt > threadState.clearedAt)) {
        transcript = typeof escalation.transcript === "string"
          ? JSON.parse(escalation.transcript)
          : (escalation.transcript as unknown[]);
      }

      if (!Array.isArray(transcript) || transcript.length === 0) {
        const session = await prisma.chatSession.findUnique({
          where: { customerId_fashionHouseId: { customerId, fashionHouseId } },
        });
        if (
          session?.history &&
          Array.isArray(session.history) &&
          (!threadState || session.updatedAt > threadState.clearedAt)
        ) {
          transcript = session.history as unknown[];
        }
      }
    } catch {
      // If parsing fails, transcript stays empty — non-fatal
    }

    res.json({ messages, transcript });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/direct-messages/thread/:fashionHouseId
// Removes the conversation for the signed-in user without erasing the other participant's copy.
router.delete("/thread/:fashionHouseId", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(
      req.authUserId!,
      req.params.fashionHouseId
    );

    await prisma.directMessageThreadState.upsert({
      where: {
        userId_fashionHouseId_customerId: {
          userId: req.authUserId!,
          fashionHouseId,
          customerId,
        },
      },
      update: { clearedAt: new Date() },
      create: {
        userId: req.authUserId!,
        fashionHouseId,
        customerId,
        clearedAt: new Date(),
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/direct-messages/messages/:messageId
// "Delete for everyone": sender-only and available for ten minutes.
router.delete("/messages/:messageId", async (req, res, next) => {
  try {
    const message = await prisma.directMessage.findUnique({
      where: { id: req.params.messageId },
    });
    if (!message) return res.status(404).json({ error: "Message not found." });
    if (message.senderId !== req.authUserId) {
      return res.status(403).json({ error: "You can only delete messages that you sent." });
    }

    const deleteWindowMs = 10 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > deleteWindowMs) {
      return res.status(400).json({ error: "Messages can only be deleted for everyone within ten minutes." });
    }

    const deletedMessage = await prisma.directMessage.update({
      where: { id: message.id },
      data: {
        text: "",
        imageUrl: null,
        audioUrl: null,
        audioDuration: null,
        deletedForEveryoneAt: message.deletedForEveryoneAt ?? new Date(),
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    res.json(deletedMessage);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/direct-messages/messages/:messageId/me
// Removes one message only from the signed-in participant's view.
router.delete("/messages/:messageId/me", async (req, res, next) => {
  try {
    const message = await prisma.directMessage.findUnique({
      where: { id: req.params.messageId },
    });
    if (!message) return res.status(404).json({ error: "Message not found." });

    const isCustomer = message.customerId === req.authUserId;
    const isFashionHouseAdmin = await prisma.fashionHouse.findFirst({
      where: { id: message.fashionHouseId, adminId: req.authUserId! },
      select: { id: true },
    });
    if (!isCustomer && !isFashionHouseAdmin) {
      return res.status(403).json({ error: "You do not have access to this message." });
    }

    await prisma.directMessageUserDeletion.upsert({
      where: {
        userId_messageId: {
          userId: req.authUserId!,
          messageId: message.id,
        },
      },
      update: { deletedAt: new Date() },
      create: { userId: req.authUserId!, messageId: message.id },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/direct-messages/thread/:fashionHouseId
// Customer sends to fashion house; admin sends to customer
router.post("/thread/:fashionHouseId", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId, senderRole, senderId } = await resolveThread(req.authUserId!, req.params.fashionHouseId);
    const { text, imageUrl, audioUrl, audioDuration } = req.body as {
      text?: string;
      imageUrl?: string;
      audioUrl?: string;
      audioDuration?: number;
    };

    if (!text?.trim() && !imageUrl && !audioUrl) {
      return res.status(400).json({ error: "Message text, image, or audio is required." });
    }

    const message = await prisma.directMessage.create({
      data: {
        fashionHouseId,
        customerId,
        senderRole,
        senderId,
        text: text?.trim() ?? "",
        imageUrl: imageUrl ?? null,
        audioUrl: audioUrl ?? null,
        audioDuration: audioDuration ? Math.round(Number(audioDuration)) : null,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    // Push notifications — WhatsApp-style: always notify the other party
    const notifBody = audioUrl
      ? "🎙️ Voice message"
      : imageUrl
      ? "📷 Photo"
      : (text?.trim() || "").slice(0, 100);

    if (senderRole === "customer") {
      // Customer → admin: notify the fashion house admin
      const senderName = message.sender?.name || "A customer";
      sendNotificationToAdmin(
        fashionHouseId,
        senderName,
        notifBody,
        { screen: "messages", customerId }
      );
    } else {
      // Admin → customer: notify the customer
      const fhName = await prisma.fashionHouse
        .findUnique({ where: { id: fashionHouseId }, select: { shopName: true } })
        .then((fh) => fh?.shopName || "The Fashion House");
      sendNotificationToUser(
        customerId,
        fhName,
        notifBody,
        { screen: "direct-chat", fashionHouseId }
      );
    }

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/direct-messages/thread/:fashionHouseId/read
router.patch("/thread/:fashionHouseId/read", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(req.authUserId!, req.params.fashionHouseId);

    await prisma.directMessage.updateMany({
      where: {
        fashionHouseId,
        customerId,
        senderId: { not: req.authUserId! },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/direct-messages/my-threads — customer endpoint to list all active chat threads
router.get("/my-threads", async (req, res, next) => {
  try {
    const customerId = req.authUserId;
    if (!customerId) {
      return res.status(401).json({ error: "Unauthorized access." });
    }

    // Find all distinct fashion houses where this customer has direct messages
    const distinctThreads = await prisma.directMessage.findMany({
      where: {
        customerId,
        userDeletions: { none: { userId: customerId } },
      },
      distinct: ["fashionHouseId"],
      orderBy: { createdAt: "desc" },
      include: {
        fashionHouse: {
          select: { id: true, shopName: true, brandLogoUrl: true },
        },
      },
    });

    const threads = await Promise.all(
      distinctThreads.map(async (dm) => {
        const threadState = await prisma.directMessageThreadState.findUnique({
          where: {
            userId_fashionHouseId_customerId: {
              userId: customerId,
              fashionHouseId: dm.fashionHouseId,
              customerId,
            },
          },
        });
        const visibleAfter = threadState?.clearedAt;
        const [latestMessage, unreadCount] = await Promise.all([
          prisma.directMessage.findFirst({
            where: {
              customerId,
              fashionHouseId: dm.fashionHouseId,
              ...(visibleAfter ? { createdAt: { gt: visibleAfter } } : {}),
              userDeletions: { none: { userId: customerId } },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.directMessage.count({
            where: {
              customerId,
              fashionHouseId: dm.fashionHouseId,
              senderRole: { not: "customer" },
              readAt: null,
              ...(visibleAfter ? { createdAt: { gt: visibleAfter } } : {}),
              userDeletions: { none: { userId: customerId } },
            },
          }),
        ]);

        if (!latestMessage) return null;

        let snippet = latestMessage.deletedForEveryoneAt
          ? "This message was deleted"
          : latestMessage.text || "";
        if (!snippet) {
          if (latestMessage?.imageUrl) snippet = "📷 Photo";
          else snippet = "Voice message";
        }

        return {
          fashionHouseId: dm.fashionHouseId,
          fashionHouseName: dm.fashionHouse?.shopName || "Fashion House",
          fashionHouseLogo: dm.fashionHouse?.brandLogoUrl || null,
          latestMessage: snippet,
          latestAt: latestMessage?.createdAt || null,
          unreadCount,
        };
      })
    );

    res.json(threads.filter((thread): thread is NonNullable<typeof thread> => thread !== null));
  } catch (err) {
    next(err);
  }
});

// GET /api/direct-messages/threads — admin only, lists all customer threads with unread count
router.get("/threads", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUserId! } });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }

    const fh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
    if (!fh) return res.status(404).json({ error: "Fashion house not found." });

    // Find all distinct customers who have messages in this fashion house
    const distinctCustomers = await prisma.directMessage.findMany({
      where: {
        fashionHouseId: fh.id,
        userDeletions: { none: { userId: user.id } },
      },
      distinct: ["customerId"],
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    // For each customer, get latest message + unread count (messages sent by customer, not read yet)
    const threads = await Promise.all(
      distinctCustomers.map(async (dm: { customerId: string; customer: { id: string; name: string | null; email: string } }) => {
        const threadState = await prisma.directMessageThreadState.findUnique({
          where: {
            userId_fashionHouseId_customerId: {
              userId: user.id,
              fashionHouseId: fh.id,
              customerId: dm.customerId,
            },
          },
        });
        const visibleAfter = threadState?.clearedAt;
        const [latestMessage, unreadCount] = await Promise.all([
          prisma.directMessage.findFirst({
            where: {
              fashionHouseId: fh.id,
              customerId: dm.customerId,
              ...(visibleAfter ? { createdAt: { gt: visibleAfter } } : {}),
              userDeletions: { none: { userId: user.id } },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.directMessage.count({
            where: {
              fashionHouseId: fh.id,
              customerId: dm.customerId,
              senderRole: "customer",
              readAt: null,
              ...(visibleAfter ? { createdAt: { gt: visibleAfter } } : {}),
              userDeletions: { none: { userId: user.id } },
            },
          }),
        ]);

        if (!latestMessage) return null;

        let snippet = latestMessage.deletedForEveryoneAt
          ? "This message was deleted"
          : latestMessage.text || "";
        if (!snippet) {
          if (latestMessage?.imageUrl) snippet = "📷 Photo";
          else if (latestMessage?.audioUrl) snippet = "🎙️ Voice message";
          else snippet = "No messages yet";
        }

        return {
          customerId: dm.customerId,
          customerName: dm.customer.name || dm.customer.email || "Customer",
          customerEmail: dm.customer.email,
          latestMessage: snippet,
          latestAt: latestMessage?.createdAt ?? null,
          unreadCount,
        };
      })
    );

    // Sort threads by latest message timestamp descending
    const visibleThreads = threads.filter(
      (thread): thread is NonNullable<typeof thread> => thread !== null
    );
    visibleThreads.sort((a, b) => {
      const timeA = a.latestAt ? new Date(a.latestAt).getTime() : 0;
      const timeB = b.latestAt ? new Date(b.latestAt).getTime() : 0;
      return timeB - timeA;
    });

    res.json(visibleThreads);
  } catch (err) {
    next(err);
  }
});

export default router;
