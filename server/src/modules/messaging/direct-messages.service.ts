import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { DirectMessagesInput } from "./direct-messages.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import type { AccountIdentity } from "../../core/auth/account-identity";
import type { Prisma } from "../../generated/prisma/client";

import { sendNotificationToUser, sendNotificationToAdmin } from "../../lib/notifications";
import { isUniqueConstraintError } from "../../lib/idempotency";

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
  req: AccountIdentity,
  message: { fashionHouseId: string; customerId: string }
) {
  return (
    (req.authRole === "customer" && message.customerId === req.authUserId) ||
    (req.authRole === "admin" && message.fashionHouseId === req.authFashionHouseId)
  );
}

// Customers address a fashion house. Admins address a customer in their own house.

// GET /api/direct-messages/thread/:fashionHouseId
// Customer: loads their thread with that fashion house
// Admin: paramFhId is treated as the customerId — loads that customer's thread

// DELETE /api/direct-messages/thread/:fashionHouseId
// Removes the conversation for the signed-in user without erasing the other participant's copy.

// DELETE /api/direct-messages/messages/:messageId
// "Delete for everyone": sender-only and available for ten minutes.

// DELETE /api/direct-messages/messages/:messageId/me
// Removes one message only from the signed-in participant's view.

// POST /api/direct-messages/thread/:fashionHouseId
// Customer sends to fashion house; admin sends to customer

// PATCH /api/direct-messages/thread/:fashionHouseId/read

// GET /api/direct-messages/my-threads — customer endpoint to list all active chat threads

// GET /api/direct-messages/threads — admin only, lists all customer threads with unread count

@Injectable()
export class DirectMessagesService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async getThreadByFashionHouseId(input: DirectMessagesInput<"getThreadByFashionHouseId">) {

    const { fashionHouseId, customerId } = await this.resolveThread(input, routeParam(input, "fashionHouseId"));
    const syncStartedAt = new Date();
    const { limit, cursor, after, since } = input.query as unknown as {
      limit: number;
      cursor?: string;
      after?: string;
      since?: string;
    };

    const threadState = await this.database.client.directMessageThreadState.findUnique({
      where: {
        userId_fashionHouseId_customerId: {
          userId: input.authUserId!,
          fashionHouseId,
          customerId,
        },
      },
    });

    const visibleMessageWhere: Prisma.DirectMessageWhereInput = {
      fashionHouseId,
      customerId,
      ...(threadState ? { createdAt: { gt: threadState.clearedAt } } : {}),
      userDeletions: { none: { userId: input.authUserId! } },
    };

    const anchorId = after ?? cursor;
    const anchor = anchorId
      ? await this.database.client.directMessage.findFirst({
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

    const fetchedMessages = await this.database.client.directMessage.findMany({
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
      await this.database.client.directMessage.updateMany({
        where: {
          fashionHouseId,
          customerId,
          senderId: { not: input.authUserId! },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    } else if (messages.length > 0) {
      await this.database.client.directMessage.updateMany({
        where: {
          id: { in: messages.map((message) => message.id) },
          senderId: { not: input.authUserId! },
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
        const escalation = await this.database.client.chatEscalation.findFirst({
          where: { fashionHouseId, customerId },
          orderBy: { createdAt: "desc" },
        });
        if (escalation?.transcript && (!threadState || escalation.createdAt > threadState.clearedAt)) {
          transcript = typeof escalation.transcript === "string"
            ? JSON.parse(escalation.transcript)
            : (escalation.transcript as unknown[]);
        }

        if (!Array.isArray(transcript) || transcript.length === 0) {
          const session = await this.database.client.chatSession.findUnique({
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

    return {
      messages,
      transcript,
      pageInfo: {
        hasMoreOlder: pageDirection === "older" && hasMore,
        hasMoreNewer: pageDirection === "newer" && hasMore,
        olderCursor: messages[0]?.id ?? cursor ?? null,
        latestCursor: newestCreatedMessage?.id ?? after ?? null,
        syncCursor: syncStartedAt.toISOString(),
      },
    };

  }

  async deleteThreadByFashionHouseId(input: DirectMessagesInput<"deleteThreadByFashionHouseId">) {

    const { fashionHouseId, customerId } = await this.resolveThread(input, routeParam(input, "fashionHouseId"));

    await this.database.client.directMessageThreadState.upsert({
      where: {
        userId_fashionHouseId_customerId: {
          userId: input.authUserId!,
          fashionHouseId,
          customerId,
        },
      },
      update: { clearedAt: new Date() },
      create: {
        userId: input.authUserId!,
        fashionHouseId,
        customerId,
        clearedAt: new Date(),
      },
    });

    return { success: true };

  }

  async deleteMessagesByMessageId(input: DirectMessagesInput<"deleteMessagesByMessageId">) {

    const message = await this.database.client.directMessage.findUnique({
      where: { id: routeParam(input, "messageId") },
    });
    if (!message) return rejectRequest({ error: "Message not found." }, 404);
    if (!canAccessMessage(input, message)) {
      return rejectRequest({ error: "You do not have access to this message." }, 403);
    }
    if (message.senderId !== input.authUserId) {
      return rejectRequest({ error: "You can only delete messages that you sent." }, 403);
    }

    const deleteWindowMs = 10 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > deleteWindowMs) {
      return rejectRequest({ error: "Messages can only be deleted for everyone within ten minutes." }, 400);
    }

    const deletedMessage = await this.database.client.directMessage.update({
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

    return deletedMessage;

  }

  async deleteMessagesByMessageIdMe(input: DirectMessagesInput<"deleteMessagesByMessageIdMe">) {

    const message = await this.database.client.directMessage.findUnique({
      where: { id: routeParam(input, "messageId") },
    });
    if (!message) return rejectRequest({ error: "Message not found." }, 404);

    if (!canAccessMessage(input, message)) {
      return rejectRequest({ error: "You do not have access to this message." }, 403);
    }

    await this.database.client.directMessageUserDeletion.upsert({
      where: {
        userId_messageId: {
          userId: input.authUserId!,
          messageId: message.id,
        },
      },
      update: { deletedAt: new Date() },
      create: { userId: input.authUserId!, messageId: message.id },
    });

    return { success: true };

  }

  async postThreadByFashionHouseId(input: DirectMessagesInput<"postThreadByFashionHouseId">) {

    const { fashionHouseId, customerId, senderRole, senderId } = await this.resolveThread(input, routeParam(input, "fashionHouseId"));
    const { text, imageUrl, audioUrl, audioDuration, clientMessageId } = input.body as {
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

    const existingMessage = await this.database.client.directMessage.findUnique({
      where: { senderId_clientMessageId: { senderId, clientMessageId } },
      include: { sender: { select: { id: true, name: true, role: true } } },
    });
    if (existingMessage) {
      if (!isSameRequest(existingMessage)) {
        return rejectRequest({
          code: "IDEMPOTENCY_KEY_REUSED",
          error: "This message couldn't be sent. Please try sending it again.",
        }, 409);
      }
      return existingMessage;
    }

    let message;
    try {
      message = await this.database.client.directMessage.create({
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
      const racedMessage = await this.database.client.directMessage.findUnique({
        where: { senderId_clientMessageId: { senderId, clientMessageId } },
        include: { sender: { select: { id: true, name: true, role: true } } },
      });
      if (!racedMessage) throw error;
      if (!isSameRequest(racedMessage)) {
        return rejectRequest({
          code: "IDEMPOTENCY_KEY_REUSED",
          error: "This message couldn't be sent. Please try sending it again.",
        }, 409);
      }
      return racedMessage;
    }

    if (senderRole === "admin") {
      await this.database.client.chatEscalation.updateMany({
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
      const fhName = await this.database.client.fashionHouse
        .findUnique({ where: { id: fashionHouseId }, select: { shopName: true } })
        .then((fh) => fh?.shopName || "The Fashion House");
      sendNotificationToUser(
        customerId,
        fhName,
        notifBody,
        { screen: "direct-chat", fashionHouseId }
      );
    }

    return result({ ...message, isRead: Boolean(message.readAt) }, 201);

  }

  async patchThreadByFashionHouseIdRead(input: DirectMessagesInput<"patchThreadByFashionHouseIdRead">) {

    const { fashionHouseId, customerId } = await this.resolveThread(input, routeParam(input, "fashionHouseId"));

    await this.database.client.directMessage.updateMany({
      where: {
        fashionHouseId,
        customerId,
        senderId: { not: input.authUserId! },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { success: true };

  }

  async getMyThreads(input: DirectMessagesInput<"getMyThreads">) {

    const customerId = input.authUserId;
    if (!customerId || input.authRole !== "customer") {
      return rejectRequest({ error: "Please use a customer account to open this page." }, 403);
    }

    const rows = await this.database.client.$queryRaw<Array<{
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

    return rows.map((row) => ({
      fashionHouseId: row.fashionHouseId,
      fashionHouseName: row.fashionHouseName || "Fashion House",
      fashionHouseLogo: row.fashionHouseLogo,
      latestMessage: row.deletedForEveryoneAt
        ? "This message was deleted"
        : row.text || (row.imageUrl ? "Photo" : row.audioUrl ? "Voice message" : "No messages yet"),
      latestAt: row.latestAt,
      unreadCount: Number(row.unreadCount),
    }));

  }

  async getThreads(input: DirectMessagesInput<"getThreads">) {

    const adminId = input.authUserId;
    const fashionHouseId = input.authFashionHouseId;
    if (!adminId || input.authRole !== "admin") {
      return rejectRequest({ error: "Admin access required." }, 403);
    }
    if (!fashionHouseId) return rejectRequest({ error: "Fashion house not found." }, 404);

    const rows = await this.database.client.$queryRaw<Array<{
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

    return rows.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName || row.customerEmail || "Customer",
      customerEmail: row.customerEmail,
      latestMessage: row.deletedForEveryoneAt
        ? "This message was deleted"
        : row.text || (row.imageUrl ? "Photo" : row.audioUrl ? "Voice message" : "No messages yet"),
      latestAt: row.latestAt,
      unreadCount: Number(row.unreadCount),
    }));

  }

  private async assertAdminCustomerRelationship(fashionHouseId: string, customerId: string) {
    const [customer, crmCustomer] = await Promise.all([
      this.database.client.user.findFirst({
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
      this.database.client.customer.findFirst({
        where: { fashionHouseId, userId: customerId },
        select: { id: true },
      }),
    ]);

    if (!customer && !crmCustomer) {
      throw httpError("This customer is not associated with your fashion house.", 403);
    }

    // A CRM record is tenant evidence, but the message target must still be a live customer account.
    if (!customer) {
      const customerAccount = await this.database.client.user.findFirst({
        where: { id: customerId, role: "customer", active: true },
        select: { id: true },
      });
      if (!customerAccount) throw httpError("Customer account not found.", 404);
    }
  }

  private async resolveThread(req: AccountIdentity, targetId: string): Promise<ResolvedThread> {
    const senderId = req.authUserId;
    if (!senderId || !req.authRole) throw httpError("Unauthorized access.", 401);

    if (req.authRole === "admin") {
      const fashionHouseId = req.authFashionHouseId;
      if (!fashionHouseId) throw httpError("Fashion house not found for admin.", 404);
      await this.assertAdminCustomerRelationship(fashionHouseId, targetId);
      return { fashionHouseId, customerId: targetId, senderRole: "admin", senderId };
    }

    if (req.authRole === "customer") {
      const fashionHouse = await this.database.client.fashionHouse.findUnique({
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
}

