import { Router } from "express";
import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendNotificationToUser, sendNotificationToAdmin } from "../lib/notifications";
import { isUniqueConstraintError } from "../lib/idempotency";
import {
  directMessageIdParamSchema,
  directMessageThreadParamSchema,
  directMessageThreadQuerySchema,
  sendDirectMessageSchema,
} from "../schemas/directMessages.schema";

const router = Router();
router.use(requireAuth);

// Helper: resolve the fashionHouseId and customerId for a thread
type ResolvedThread = {
  fashionHouseId: string;
  customerId: string;
  senderRole: "admin" | "customer";
  senderId: string;
};

function httpError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function canAccessMessage(
  req: Request,
  message: { fashionHouseId: string; customerId: string }
) {
  return (
    (req.authRole === "customer" && message.customerId === req.authUserId) ||
    (req.authRole === "admin" && message.fashionHouseId === req.authFashionHouseId)
  );
}

async function assertAdminCustomerRelationship(fashionHouseId: string, customerId: string) {
  const [customer, crmCustomer] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: customerId,
        role: "customer",
        active: true,
        OR: [
          { receivedDirectMessages: { some: { fashionHouseId } } },
          { bookings: { some: { fashionHouseId } } },
          { chatSessions: { some: { fashionHouseId } } },
          { chatEscalations: { some: { fashionHouseId } } },
        ],
      },
      select: { id: true },
    }),
    prisma.customer.findFirst({
      where: { fashionHouseId, userId: customerId },
      select: { id: true },
    }),
  ]);

  if (!customer && !crmCustomer) {
    throw httpError("This customer is not associated with your fashion house.", 403);
  }

  // A CRM record is tenant evidence, but the message target must still be a live customer account.
  if (!customer) {
    const customerAccount = await prisma.user.findFirst({
      where: { id: customerId, role: "customer", active: true },
      select: { id: true },
    });
    if (!customerAccount) throw httpError("Customer account not found.", 404);
  }
}

// Customers address a fashion house. Admins address a customer in their own house.
async function resolveThread(req: Request, targetId: string): Promise<ResolvedThread> {
  const senderId = req.authUserId;
  if (!senderId || !req.authRole) throw httpError("Unauthorized access.", 401);

  if (req.authRole === "admin") {
    const fashionHouseId = req.authFashionHouseId;
    if (!fashionHouseId) throw httpError("Fashion house not found for admin.", 404);
    await assertAdminCustomerRelationship(fashionHouseId, targetId);
    return { fashionHouseId, customerId: targetId, senderRole: "admin", senderId };
  }

  if (req.authRole === "customer") {
    const fashionHouse = await prisma.fashionHouse.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!fashionHouse) throw httpError("Fashion house not found.", 404);
    return {
      fashionHouseId: fashionHouse.id,
      customerId: senderId,
      senderRole: "customer",
      senderId,
    };
  }

  throw httpError("Staff accounts cannot access customer direct messages.", 403);
}

// GET /api/direct-messages/thread/:fashionHouseId
// Customer: loads their thread with that fashion house
// Admin: paramFhId is treated as the customerId — loads that customer's thread
router.get(
  "/thread/:fashionHouseId",
  validate({ params: directMessageThreadParamSchema, query: directMessageThreadQuerySchema }),
  async (req, res, next) => {
    try {
    const { fashionHouseId, customerId } = await resolveThread(req, req.params.fashionHouseId);
    const syncStartedAt = new Date();
    const { limit, cursor, after, since } = req.query as unknown as {
      limit: number;
      cursor?: string;
      after?: string;
      since?: string;
    };

    const threadState = await prisma.directMessageThreadState.findUnique({
      where: {
        userId_fashionHouseId_customerId: {
          userId: req.authUserId!,
          fashionHouseId,
          customerId,
        },
      },
    });

    const visibleMessageWhere: Prisma.DirectMessageWhereInput = {
      fashionHouseId,
      customerId,
      ...(threadState ? { createdAt: { gt: threadState.clearedAt } } : {}),
      userDeletions: { none: { userId: req.authUserId! } },
    };

    const anchorId = after ?? cursor;
    const anchor = anchorId
      ? await prisma.directMessage.findFirst({
          where: { id: anchorId, fashionHouseId, customerId },
          select: { id: true, createdAt: true },
        })
      : null;
    if (anchorId && !anchor) throw httpError("Message cursor is no longer available.", 400);

    const pageDirection = after ? "newer" : "older";
    const changeSince = since ? new Date(since) : anchor?.createdAt;
    const cursorFilter: Prisma.DirectMessageWhereInput = !anchor
      ? {}
      : pageDirection === "newer"
      ? {
          OR: [
            { createdAt: { gt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { gt: anchor.id } },
            { deletedForEveryoneAt: { gt: changeSince! } },
            { readAt: { gt: changeSince! } },
          ],
        }
      : {
          OR: [
            { createdAt: { lt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { lt: anchor.id } },
          ],
        };

    const fetchedMessages = await prisma.directMessage.findMany({
      where: { AND: [visibleMessageWhere, cursorFilter] },
      orderBy: [
        { createdAt: pageDirection === "newer" ? "asc" : "desc" },
        { id: pageDirection === "newer" ? "asc" : "desc" },
      ],
      take: limit + 1,
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    const hasMore = fetchedMessages.length > limit;
    const page = fetchedMessages.slice(0, limit);
    const orderedMessages = pageDirection === "older" ? page.reverse() : page;
    const messages = orderedMessages.map((message) => ({
      ...message,
      isRead: Boolean(message.readAt),
    }));
    const newestCreatedMessage = pageDirection === "newer" && anchor
      ? [...messages].reverse().find((message) =>
          message.createdAt.getTime() > anchor.createdAt.getTime() ||
          (message.createdAt.getTime() === anchor.createdAt.getTime() && message.id > anchor.id)
        )
      : messages[messages.length - 1];

    // Mark unread messages sent to this user as read
    if (!cursor && !after) {
      await prisma.directMessage.updateMany({
        where: {
          fashionHouseId,
          customerId,
          senderId: { not: req.authUserId! },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    } else if (messages.length > 0) {
      await prisma.directMessage.updateMany({
        where: {
          id: { in: messages.map((message) => message.id) },
          senderId: { not: req.authUserId! },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }

    // Attach the AI chat transcript from the latest escalation or chatSession for this thread
    // so both customer and admin can see the prior AI conversation history
    let transcript: unknown[] = [];
    if (!cursor && !after) {
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
    }

    res.json({
      messages,
      transcript,
      pageInfo: {
        hasMoreOlder: pageDirection === "older" && hasMore,
        hasMoreNewer: pageDirection === "newer" && hasMore,
        olderCursor: messages[0]?.id ?? cursor ?? null,
        latestCursor: newestCreatedMessage?.id ?? after ?? null,
        syncCursor: syncStartedAt.toISOString(),
      },
    });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/direct-messages/thread/:fashionHouseId
// Removes the conversation for the signed-in user without erasing the other participant's copy.
router.delete("/thread/:fashionHouseId", validate({ params: directMessageThreadParamSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(req, req.params.fashionHouseId);

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
router.delete("/messages/:messageId", validate({ params: directMessageIdParamSchema }), async (req, res, next) => {
  try {
    const message = await prisma.directMessage.findUnique({
      where: { id: req.params.messageId },
    });
    if (!message) return res.status(404).json({ error: "Message not found." });
    if (!canAccessMessage(req, message)) {
      return res.status(403).json({ error: "You do not have access to this message." });
    }
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
router.delete("/messages/:messageId/me", validate({ params: directMessageIdParamSchema }), async (req, res, next) => {
  try {
    const message = await prisma.directMessage.findUnique({
      where: { id: req.params.messageId },
    });
    if (!message) return res.status(404).json({ error: "Message not found." });

    if (!canAccessMessage(req, message)) {
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
router.post(
  "/thread/:fashionHouseId",
  validate({ params: directMessageThreadParamSchema, body: sendDirectMessageSchema }),
  async (req, res, next) => {
    try {
      const { fashionHouseId, customerId, senderRole, senderId } = await resolveThread(req, req.params.fashionHouseId);
      const { text, imageUrl, audioUrl, audioDuration, clientMessageId } = req.body as {
        text?: string;
        imageUrl?: string;
        audioUrl?: string;
        audioDuration?: number;
        clientMessageId: string;
      };

    const normalizedText = text ?? "";
    const normalizedImageUrl = imageUrl ?? null;
    const normalizedAudioUrl = audioUrl ?? null;
    const parsedAudioDuration = audioDuration == null ? null : Math.round(audioDuration);

    const isSameRequest = (candidate: {
      fashionHouseId: string;
      customerId: string;
      text: string;
      imageUrl: string | null;
      audioUrl: string | null;
      audioDuration: number | null;
    }) =>
      candidate.fashionHouseId === fashionHouseId &&
      candidate.customerId === customerId &&
      candidate.text === normalizedText &&
      candidate.imageUrl === normalizedImageUrl &&
      candidate.audioUrl === normalizedAudioUrl &&
      candidate.audioDuration === parsedAudioDuration;

    const existingMessage = await prisma.directMessage.findUnique({
      where: { senderId_clientMessageId: { senderId, clientMessageId } },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    if (existingMessage) {
      if (!isSameRequest(existingMessage)) {
        return res.status(409).json({
          code: "IDEMPOTENCY_KEY_REUSED",
          error: "This message key was already used for a different message.",
        });
      }
      return res.json(existingMessage);
    }

    let message;
    try {
      message = await prisma.directMessage.create({
        data: {
          fashionHouseId,
          customerId,
          senderRole,
          senderId,
          clientMessageId,
          text: normalizedText,
          imageUrl: normalizedImageUrl,
          audioUrl: normalizedAudioUrl,
          audioDuration: parsedAudioDuration,
        },
        include: {
          sender: { select: { id: true, name: true, role: true } },
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const racedMessage = await prisma.directMessage.findUnique({
        where: { senderId_clientMessageId: { senderId, clientMessageId } },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
      if (!racedMessage) throw error;
      if (!isSameRequest(racedMessage)) {
        return res.status(409).json({
          code: "IDEMPOTENCY_KEY_REUSED",
          error: "This message key was already used for a different message.",
        });
      }
      return res.json(racedMessage);
    }

    if (senderRole === "admin") {
      await prisma.chatEscalation.updateMany({
        where: { fashionHouseId, customerId, resolved: false },
        data: { status: "human_active" },
      });
    }

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

      res.status(201).json({ ...message, isRead: Boolean(message.readAt) });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/direct-messages/thread/:fashionHouseId/read
router.patch("/thread/:fashionHouseId/read", validate({ params: directMessageThreadParamSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(req, req.params.fashionHouseId);

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
    if (!customerId || req.authRole !== "customer") {
      return res.status(403).json({ error: "Customer access required." });
    }

    const rows = await prisma.$queryRaw<Array<{
      fashionHouseId: string;
      fashionHouseName: string;
      fashionHouseLogo: string | null;
      text: string;
      imageUrl: string | null;
      audioUrl: string | null;
      deletedForEveryoneAt: Date | null;
      latestAt: Date;
      unreadCount: bigint | number;
    }>>`
      WITH "visibleMessages" AS (
        SELECT
          dm.*,
          ROW_NUMBER() OVER (
            PARTITION BY dm."fashionHouseId"
            ORDER BY dm."createdAt" DESC, dm."id" DESC
          ) AS "rowNumber",
          COUNT(*) FILTER (
            WHERE dm."senderRole" <> 'customer' AND dm."readAt" IS NULL
          ) OVER (PARTITION BY dm."fashionHouseId") AS "unreadCount"
        FROM "direct_messages" dm
        LEFT JOIN "direct_message_thread_states" state
          ON state."userId" = ${customerId}
          AND state."fashionHouseId" = dm."fashionHouseId"
          AND state."customerId" = dm."customerId"
        WHERE dm."customerId" = ${customerId}
          AND (state."clearedAt" IS NULL OR dm."createdAt" > state."clearedAt")
          AND NOT EXISTS (
            SELECT 1
            FROM "direct_message_user_deletions" deletion
            WHERE deletion."userId" = ${customerId}
              AND deletion."messageId" = dm."id"
          )
      )
      SELECT
        message."fashionHouseId",
        house."shopName" AS "fashionHouseName",
        house."brandLogoUrl" AS "fashionHouseLogo",
        message."text",
        message."imageUrl",
        message."audioUrl",
        message."deletedForEveryoneAt",
        message."createdAt" AS "latestAt",
        message."unreadCount"
      FROM "visibleMessages" message
      INNER JOIN "fashion_houses" house ON house."id" = message."fashionHouseId"
      WHERE message."rowNumber" = 1
      ORDER BY message."createdAt" DESC, message."id" DESC
    `;

    res.json(rows.map((row) => ({
      fashionHouseId: row.fashionHouseId,
      fashionHouseName: row.fashionHouseName || "Fashion House",
      fashionHouseLogo: row.fashionHouseLogo,
      latestMessage: row.deletedForEveryoneAt
        ? "This message was deleted"
        : row.text || (row.imageUrl ? "Photo" : row.audioUrl ? "Voice message" : "No messages yet"),
      latestAt: row.latestAt,
      unreadCount: Number(row.unreadCount),
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/direct-messages/threads — admin only, lists all customer threads with unread count
router.get("/threads", async (req, res, next) => {
  try {
    const adminId = req.authUserId;
    const fashionHouseId = req.authFashionHouseId;
    if (!adminId || req.authRole !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    if (!fashionHouseId) return res.status(404).json({ error: "Fashion house not found." });

    const rows = await prisma.$queryRaw<Array<{
      customerId: string;
      customerName: string | null;
      customerEmail: string;
      text: string;
      imageUrl: string | null;
      audioUrl: string | null;
      deletedForEveryoneAt: Date | null;
      latestAt: Date;
      unreadCount: bigint | number;
    }>>`
      WITH "visibleMessages" AS (
        SELECT
          dm.*,
          ROW_NUMBER() OVER (
            PARTITION BY dm."customerId"
            ORDER BY dm."createdAt" DESC, dm."id" DESC
          ) AS "rowNumber",
          COUNT(*) FILTER (
            WHERE dm."senderRole" = 'customer' AND dm."readAt" IS NULL
          ) OVER (PARTITION BY dm."customerId") AS "unreadCount"
        FROM "direct_messages" dm
        LEFT JOIN "direct_message_thread_states" state
          ON state."userId" = ${adminId}
          AND state."fashionHouseId" = dm."fashionHouseId"
          AND state."customerId" = dm."customerId"
        WHERE dm."fashionHouseId" = ${fashionHouseId}
          AND (state."clearedAt" IS NULL OR dm."createdAt" > state."clearedAt")
          AND NOT EXISTS (
            SELECT 1
            FROM "direct_message_user_deletions" deletion
            WHERE deletion."userId" = ${adminId}
              AND deletion."messageId" = dm."id"
          )
      )
      SELECT
        message."customerId",
        customer."name" AS "customerName",
        customer."email" AS "customerEmail",
        message."text",
        message."imageUrl",
        message."audioUrl",
        message."deletedForEveryoneAt",
        message."createdAt" AS "latestAt",
        message."unreadCount"
      FROM "visibleMessages" message
      INNER JOIN "users" customer ON customer."id" = message."customerId"
      WHERE message."rowNumber" = 1
      ORDER BY message."createdAt" DESC, message."id" DESC
    `;

    res.json(rows.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName || row.customerEmail || "Customer",
      customerEmail: row.customerEmail,
      latestMessage: row.deletedForEveryoneAt
        ? "This message was deleted"
        : row.text || (row.imageUrl ? "Photo" : row.audioUrl ? "Voice message" : "No messages yet"),
      latestAt: row.latestAt,
      unreadCount: Number(row.unreadCount),
    })));
  } catch (err) {
    next(err);
  }
});

export default router;
