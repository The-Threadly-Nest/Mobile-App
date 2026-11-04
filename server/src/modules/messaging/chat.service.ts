import { Inject, Injectable } from "@nestjs/common";
import type { EnhancedGenerateContentResponse } from "@google/generative-ai";
import { logFailure } from "../../core/logging";
import { routeParam } from "../../core/http/route-param";
import type { ChatInput } from "./chat.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { Prisma } from "../../generated/prisma/client";

import { getModel, buildSystemPrompt } from "../../lib/gemini";
import { buildTruncatedHistory, shouldForceEscalate, ChatTurn } from "../../lib/chatHistory";
import { checkMessageGuardrails } from "../../lib/chatGuardrails";
import { sendNotificationToUser, sendNotificationToAdmin } from "../../lib/notifications";
import { randomUUID } from "node:crypto";
import { isUniqueConstraintError, readIdempotencyKey } from "../../lib/idempotency";
import { availableSlotClaimWhere } from "../../lib/authorization";
import { formatSlotLabel } from "../../lib/availability";

// Per-user rate limit: max 30 chat messages per 10 minutes — prevents Gemini API bill abuse

type StoredChatTurn = ChatTurn & {
  id: string;
  senderId?: string;
  deletedForEveryoneAt?: string;
  deletedForUserIds?: string[];
};

class SlotUnavailableError extends Error {
  constructor() {
    super("This fitting slot is no longer available.");
    this.name = "SlotUnavailableError";
  }

}

function normalizeStoredHistory(rawHistory: ChatTurn[]) {
  let changed = false;
  const history: StoredChatTurn[] = rawHistory.map((turn) => {
    if (turn.id) return turn as StoredChatTurn;
    changed = true;
    return { ...turn, id: randomUUID() };
  });
  return { history, changed };
}

function visibleHistoryForUser(history: StoredChatTurn[], userId: string) {
  return history
    .filter((turn) => !turn.deletedForUserIds?.includes(userId))
    .map(({ deletedForUserIds: _deletedForUserIds, ...turn }) => turn);
}

function ownsStoredTurn(turn: StoredChatTurn, userId: string, role: string) {
  if (turn.senderId) return turn.senderId === userId;
  return (
    (role === "admin" && turn.role === "admin") ||
    (role === "staff" && turn.role === "staff") ||
    (role === "customer" && turn.role === "user")
  );
}

// GET /api/chat/session/:fashionHouseId — load existing session history on screen open
// Starts a fresh automated booking conversation while preserving the previous
// escalation record and transcript as resolved support history.

// POST /api/chat/message — send a message; history is fully managed server-side
// Removes the message content for both participants when requested by its sender within ten minutes.

// Hides a message only for the signed-in participant.

// POST /api/chat/escalate — Direct customer-initiated chat escalation to Admin

type ActivateHumanHandoffInput = {
  sessionId: string;
  fashionHouseId: string;
  customerId: string;
  history: ChatTurn[];
  triggerMessage?: string;
  reason: string;
  summary: string;
  reply: string;
};

@Injectable()
export class ChatService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async postSessionByFashionHouseIdRestart(input: ChatInput<"postSessionByFashionHouseIdRestart">) {
    try {
      const authUserId = input.authUserId!;
      const { sessionCustomerId, fashionHouseId, role } = await this.resolveSessionTarget(
        routeParam(input, "fashionHouseId"),
        authUserId
      );
      if (role !== "customer") {
        return rejectRequest({ error: "Only customers can start a new booking conversation." }, 403);
      }

      await this.database.client.$transaction(async (transaction) => {
        await transaction.chatEscalation.updateMany({
          where: { fashionHouseId, customerId: sessionCustomerId, resolved: false },
          data: { resolved: true, status: "resolved", activeKey: null },
        });
        await transaction.chatSession.upsert({
          where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
          update: { history: [] },
          create: { customerId: sessionCustomerId, fashionHouseId, history: [] },
        });
      });

      return { success: true, conversationState: "automated" };
    } catch (err) {
      throw err;
    }
  }

  async getSessionByFashionHouseId(input: ChatInput<"getSessionByFashionHouseId">) {
    try {
      const rawParam = routeParam(input, "fashionHouseId");
      const authUserId = input.authUserId!;
      const { sessionCustomerId, fashionHouseId } = await this.resolveSessionTarget(rawParam, authUserId);

      const [session, availableSlots, activeEscalation, fashionHouse] = await Promise.all([
        this.database.client.chatSession.findUnique({
          where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
        }),
        this.database.client.availableSlot.findMany({
          where: { fashionHouseId, booked: false, active: true, startsAt: { gt: new Date() } },
          orderBy: { startsAt: "asc" },
          take: 10,
          select: { id: true, date: true, time: true, startsAt: true },
        }),
        this.database.client.chatEscalation.findUnique({
          where: { activeKey: `${fashionHouseId}:${sessionCustomerId}` },
          select: { id: true, status: true },
        }),
        this.database.client.fashionHouse.findUnique({ where: { id: fashionHouseId }, select: { timezone: true } }),
      ]);

      const rawHistory = (session?.history as unknown as ChatTurn[]) ?? [];
      const { history, changed } = normalizeStoredHistory(rawHistory);
      if (session && changed) {
        await this.database.client.chatSession.update({
          where: { id: session.id },
          data: { history: history as unknown as Prisma.InputJsonValue },
        });
      }

      return {
        history: visibleHistoryForUser(history, authUserId),
        availableSlots: availableSlots.map((slot) => ({
          id: slot.id,
          label: slot.startsAt && fashionHouse
            ? formatSlotLabel(slot.startsAt, fashionHouse.timezone)
            : `${slot.date} · ${slot.time}`,
        })),
        conversationState: activeEscalation?.status ?? "automated",
        escalationId: activeEscalation?.id ?? null,
      };
    } catch (err) {
      throw err;
    }
  }

  async deleteMessagesByMessageId(input: ChatInput<"deleteMessagesByMessageId">) {
    try {
      const rawParam = typeof input.body?.fashionHouseId === "string" ? input.body.fashionHouseId : "";
      if (!rawParam) return rejectRequest({ error: "Conversation is required." }, 400);

      const authUserId = input.authUserId!;
      const { sessionCustomerId, fashionHouseId, role } = await this.resolveSessionTarget(
        rawParam,
        authUserId
      );
      const session = await this.database.client.chatSession.findUnique({
        where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      });
      if (!session) return rejectRequest({ error: "Message not found." }, 404);

      const { history } = normalizeStoredHistory(
        (session.history as unknown as ChatTurn[]) ?? []
      );
      const messageIndex = history.findIndex((turn) => turn.id === routeParam(input, "messageId"));
      if (messageIndex < 0) return rejectRequest({ error: "Message not found." }, 404);

      const message = history[messageIndex];
      if (!ownsStoredTurn(message, authUserId, role)) {
        return rejectRequest({ error: "You can only delete messages that you sent." }, 403);
      }
      if (message.deletedForEveryoneAt) {
        return { message, history: visibleHistoryForUser(history, authUserId) };
      }

      const sentAt = message.createdAt ? new Date(message.createdAt).getTime() : Number.NaN;
      if (!Number.isFinite(sentAt) || Date.now() - sentAt > 10 * 60 * 1000) {
        return rejectRequest({ error: "This message can no longer be deleted for everyone." }, 400);
      }

      const deletedMessage: StoredChatTurn = {
        id: message.id,
        role: message.role,
        senderId: message.senderId,
        text: "This message was deleted",
        createdAt: message.createdAt,
        deletedForEveryoneAt: new Date().toISOString(),
        deletedForUserIds: message.deletedForUserIds,
      };
      history[messageIndex] = deletedMessage;

      await this.database.client.chatSession.update({
        where: { id: session.id },
        data: { history: history as unknown as Prisma.InputJsonValue },
      });
      return {
        message: deletedMessage,
        history: visibleHistoryForUser(history, authUserId),
      };
    } catch (err) {
      throw err;
    }
  }

  async deleteMessagesByMessageIdMe(input: ChatInput<"deleteMessagesByMessageIdMe">) {
    try {
      const rawParam = typeof input.body?.fashionHouseId === "string" ? input.body.fashionHouseId : "";
      if (!rawParam) return rejectRequest({ error: "Conversation is required." }, 400);

      const authUserId = input.authUserId!;
      const { sessionCustomerId, fashionHouseId } = await this.resolveSessionTarget(rawParam, authUserId);
      const session = await this.database.client.chatSession.findUnique({
        where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      });
      if (!session) return rejectRequest({ error: "Message not found." }, 404);

      const { history } = normalizeStoredHistory(
        (session.history as unknown as ChatTurn[]) ?? []
      );
      const messageIndex = history.findIndex((turn) => turn.id === routeParam(input, "messageId"));
      if (messageIndex < 0) return rejectRequest({ error: "Message not found." }, 404);

      const message = history[messageIndex];
      message.deletedForUserIds = Array.from(
        new Set([...(message.deletedForUserIds ?? []), authUserId])
      );

      await this.database.client.chatSession.update({
        where: { id: session.id },
        data: { history: history as unknown as Prisma.InputJsonValue },
      });
      return { success: true, history: visibleHistoryForUser(history, authUserId) };
    } catch (err) {
      throw err;
    }
  }

  async postMessage(input: ChatInput<"postMessage">) {
    try {
      const { fashionHouseId: rawParam, garmentName, imageUrl, audioUrl, audioDuration, availableSlotId } = input.body;
      const message = input.body.message?.trim() || (imageUrl ? "[Image]" : audioUrl ? "[Voice Note]" : "");
      const idempotencyKey = input.body.idempotencyKey || readIdempotencyKey(input.headers);
      const authUserId = input.authUserId!;
      const { sessionCustomerId, fashionHouseId, role } = await this.resolveSessionTarget(rawParam, authUserId);
      const customerId = sessionCustomerId;

      // 1. Load or create server-side session
      const session = await this.database.client.chatSession.upsert({
        where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
        update: {},
        create: { customerId: sessionCustomerId, fashionHouseId, history: [] },
      });
      const { history } = normalizeStoredHistory(
        (session.history as unknown as ChatTurn[]) ?? []
      );

      const fashionHouseExists = await this.database.client.fashionHouse.findUnique({
        where: { id: fashionHouseId },
        select: { id: true },
      });
      if (!fashionHouseExists) return rejectRequest({ error: "Fashion house not found" }, 404);

      // 1b. If the sender is staff or admin, persist human chat message directly without invoking AI
      if (role === "staff" || role === "admin") {
        const turnRole = role === "admin" ? "admin" : "staff";
        const turnText = message?.trim() || (imageUrl ? "[Image]" : audioUrl ? "[Voice Note]" : "");
        const turn: StoredChatTurn = {
          id: randomUUID(),
          role: turnRole,
          senderId: authUserId,
          text: turnText,
          createdAt: new Date().toISOString(),
        };
        if (imageUrl) turn.imageUrl = imageUrl;
        if (audioUrl) turn.audioUrl = audioUrl;
        if (audioDuration !== undefined) turn.audioDuration = audioDuration;
        const updatedHistory = [...history, turn];
        await this.database.client.chatSession.update({
          where: { id: session.id },
          data: { history: updatedHistory as unknown as Prisma.InputJsonValue },
        });

        // Fetch fashion house name for notification title
        const fhName = await this.database.client.fashionHouse.findUnique({
          where: { id: fashionHouseId },
          select: { shopName: true },
        }).then((fh) => fh?.shopName || "The Fashion House");

        // Send push notification asynchronously
        const notifBody = audioUrl ? "🎙️ Voice message received" : (message || "").slice(0, 100);
        if (role === "staff") {
          // Use the staff member's own name in the notification
          const staffName = await this.database.client.user.findUnique({
            where: { id: authUserId },
            select: { name: true },
          }).then((u) => u?.name || "A staff member");
          sendNotificationToAdmin(fashionHouseId, audioUrl ? `New Voice Note from ${staffName}` : `New Message from ${staffName}`, notifBody);
        } else {
          // Use the fashion house name when admin messages the customer
          sendNotificationToUser(sessionCustomerId, audioUrl ? `New Voice Note from ${fhName}` : `New Message from ${fhName}`, notifBody);
        }

        return { success: true, turn, history: visibleHistoryForUser(updatedHistory, authUserId) };
      }

      const activeEscalation = await this.database.client.chatEscalation.findUnique({
        where: { activeKey: `${fashionHouseId}:${customerId}` },
        select: { id: true, status: true },
      });
      if (activeEscalation) {
        return {
          type: "human_active",
          conversationState: activeEscalation.status,
          escalationId: activeEscalation.id,
          reply: "Your request is already with the fashion house team. Continue in Human Chat for direct assistance.",
        };
      }

      // 2. Cheap deterministic checks BEFORE spending an API call
      const guardrail = checkMessageGuardrails(message);
      if (guardrail.blocked) {
        const reply = "I've passed this to the fashion house team. Continue in Human Chat for direct assistance.";
        const escalation = await this.activateHumanHandoff({
          sessionId: session.id,
          fashionHouseId,
          customerId,
          history,
          triggerMessage: message,
          reason: guardrail.reason ?? "guardrail_triggered",
          summary: "The automated assistant's safety rules required a human response.",
          reply,
        });
        return { type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reason: guardrail.reason, reply };
      }

      // 3. Server-enforced turn cap
      if (shouldForceEscalate(history)) {
        const reply = "I've passed this conversation to the fashion house team. Continue in Human Chat for direct assistance.";
        const escalation = await this.activateHumanHandoff({
          sessionId: session.id,
          fashionHouseId,
          customerId,
          history,
          triggerMessage: message,
          reason: "max_turns_exceeded",
          summary: "Conversation exceeded automated handling limits.",
          reply,
        });
        return { type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reason: "max_turns_exceeded", reply };
      }

      // 4. Real context — never let the model invent catalog items or slots
      //    Verify fashionHouseId from the client actually exists (prevents enumeration/data leak)
      const fh = await this.database.client.fashionHouse.findUnique({
        where: { id: fashionHouseId },
        include: {
          catalogItems: { take: 10, orderBy: { createdAt: "desc" } },
          availableSlots: {
            where: { booked: false, active: true, startsAt: { gt: new Date() } },
            take: 10,
            orderBy: { startsAt: "asc" },
            // Keep chat compatible while older development databases are being
            // upgraded; Prisma otherwise selects every slot column, including
            // newly introduced availability fields.
            select: {
              id: true,
              date: true,
              time: true,
              startsAt: true,
              durationMinutes: true,
            },
          },
        },
      });
      if (!fh) return rejectRequest({ error: "Fashion house not found" }, 404);

      // Fetch customer's real name
      const customerUser = await this.database.client.user.findUnique({
        where: { id: authUserId },
        select: { name: true },
      });

      const categoriesList = (fh.categories as string[]) || [];
      const specializations = categoriesList.length > 0 ? categoriesList.join(", ") : "Bespoke Couture & Traditional Attire";

      const catalogSummary =
        fh.catalogItems && fh.catalogItems.length > 0
          ? fh.catalogItems
            .map((c: any) => `${c.name}${c.description ? ` (${c.description})` : ""}${c.category ? ` [${c.category}]` : ""}`)
            .join("; ")
          : "Custom Bespoke Tailoring & Couture upon request";

      const availableSlots = fh.availableSlots.map((s: any) =>
        s.startsAt ? formatSlotLabel(s.startsAt, fh.timezone) : `${s.date} · ${s.time}`
      );

      const systemPrompt = buildSystemPrompt({
        fashionHouseName: fh.shopName,
        location: fh.location || "Nigeria",
        specializations,
        turnaroundTime: fh.bio || "2-3 weeks standard",
        catalogSummary,
        availableSlots,
        clientName: customerUser?.name || undefined,
        targetGarmentName: garmentName || undefined,
        currentDate: new Date().toISOString().split("T")[0],
      });

      // 5. Use server-side history (truncated to recent turns)
      const truncatedHistory = buildTruncatedHistory(history);

      let replyText = "";
      let isBookingCreated = false;
      let isEscalated = false;
      let providerResponse: EnhancedGenerateContentResponse | undefined;

      try {
        const model = getModel();
        const chat = model.startChat({
          history: truncatedHistory.map((t: ChatTurn) => ({ role: t.role, parts: [{ text: t.text }] })),
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        });

        const result = await chat.sendMessage(message);
        providerResponse = result.response;
      } catch (error) {
        logFailure("The booking assistant could not reach its provider. A fallback response will be used.", error);
        replyText = "The booking assistant is temporarily unavailable. Please try again, or choose Talk to Admin for help.";
      }

      // Only provider failures use the fallback. Booking and database failures
      // must reach the exception filter instead of looking like a successful reply.
      if (providerResponse) {
        const response = providerResponse;
        const functionCall = response.functionCalls()?.[0];

        if (functionCall?.name === "create_booking") {
          const args = functionCall.args as { styleNotes: string; preferredDate: string; preferredTime: string; isFirstTime?: boolean };
          let booking = idempotencyKey
            ? await this.database.client.booking.findFirst({
              where: { customerId, idempotencyKey },
              include: { availableSlot: true },
            })
            : null;
          let bookingWasCreated = false;
          if (!booking) {
            if (!idempotencyKey) {
              return rejectRequest({
                code: "IDEMPOTENCY_KEY_REQUIRED",
                error: "Please try selecting the fitting slot again.",
              }, 400);
            }
            if (!availableSlotId) {
              return rejectRequest({
                code: "SLOT_REQUIRED",
                error: "Please select one of the available fitting slots.",
                availableSlots: fh.availableSlots.map((slot: any) => ({
                  id: slot.id,
                  label: `${slot.date} · ${slot.time}`,
                })),
              }, 400);
            }

            try {
              booking = await this.database.client.$transaction(async (transaction) => {
                const claimWhere = availableSlotClaimWhere(availableSlotId, fashionHouseId);
                const slot = await transaction.availableSlot.findFirst({ where: claimWhere });
                if (!slot) throw new SlotUnavailableError();

                const claimed = await transaction.availableSlot.updateMany({
                  where: claimWhere,
                  data: { booked: true },
                });
                if (claimed.count !== 1) throw new SlotUnavailableError();

                const preferredDate = slot.startsAt;
                if (!preferredDate || preferredDate <= new Date()) throw new SlotUnavailableError();

                return transaction.booking.create({
                  data: {
                    fashionHouseId,
                    customerId,
                    availableSlotId: slot.id,
                    styleNotes: args.styleNotes,
                    preferredDate,
                    preferredTime: slot.time,
                    isFirstTime: args.isFirstTime ?? true,
                    status: "pending_admin_review",
                    idempotencyKey,
                  },
                  include: { availableSlot: true },
                });
              });
              bookingWasCreated = true;
            } catch (error) {
              booking = await this.database.client.booking.findFirst({
                where: { customerId, idempotencyKey },
                include: { availableSlot: true },
              });
              if (!booking && error instanceof SlotUnavailableError) {
                const freshSlots = await this.database.client.availableSlot.findMany({
                  where: { fashionHouseId, booked: false, active: true, startsAt: { gt: new Date() } },
                  take: 10,
                  orderBy: { startsAt: "asc" },
                });
                return rejectRequest({
                  code: "SLOT_UNAVAILABLE",
                  error: "That fitting slot was just taken. Please choose another available time.",
                  availableSlots: freshSlots.map((slot) => ({
                    id: slot.id,
                    label: slot.startsAt ? formatSlotLabel(slot.startsAt, fh.timezone) : `${slot.date} · ${slot.time}`,
                  })),
                }, 409);
              }
              if (!booking) throw error;
            }
          }
          if (bookingWasCreated) {
            sendNotificationToAdmin(
              fashionHouseId,
              "New Booking Request",
              "A customer has requested a fitting appointment.",
              { bookingId: booking.id }
            );
          }
          const reservedSlotLabel = booking.availableSlot
            ? booking.availableSlot.startsAt
              ? formatSlotLabel(booking.availableSlot.startsAt, fh.timezone)
              : `${booking.availableSlot.date} at ${booking.availableSlot.time}`
            : args.preferredTime;
          const confirmReply = `Your fitting request with ${fh.shopName} for ${reservedSlotLabel} has been received! Our team will confirm shortly.`;
          const updatedHistory: ChatTurn[] = [
            ...history,
            { role: "user", text: message },
            { role: "model", text: confirmReply },
            { role: "model", text: "--- Chat Session Ended ---" },
          ];
          await this.database.client.chatSession.update({ where: { id: session.id }, data: { history: updatedHistory as unknown as Prisma.InputJsonValue } });
          return {
            type: "booking_created",
            booking: {
              ...booking,
              availableSlot: booking.availableSlot
                ? {
                  ...booking.availableSlot,
                  startsAt: booking.availableSlot.startsAt?.toISOString() ?? null,
                  timezone: fh.timezone,
                  label: booking.availableSlot.startsAt
                    ? formatSlotLabel(booking.availableSlot.startsAt, fh.timezone)
                    : `${booking.availableSlot.date} · ${booking.availableSlot.time}`,
                }
                : null,
            },
            reply: confirmReply,
          };
        }

        if (functionCall?.name === "escalate_to_admin") {
          const args = functionCall.args as { reason: string; conversationSummary: string };
          const escReply = "I've passed this to the fashion house team. Continue in Human Chat for direct assistance.";
          const escalation = await this.activateHumanHandoff({
            sessionId: session.id,
            fashionHouseId,
            customerId,
            history,
            triggerMessage: message,
            reason: args.reason,
            summary: args.conversationSummary,
            reply: escReply,
          });
          return { type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reason: args.reason, reply: escReply };
        }

        replyText = response.text() || "";
      }

      // Clean up response formatting
      let modelReply = (replyText || "I couldn't prepare a reply. Please try again, or choose Talk to Admin for help.")
        .replace(/—/g, ", ")
        .replace(/--/g, ", ")
        .replace(/_/g, "")
        .replace(/atelier/gi, "Fashion House");

      const updatedHistory: ChatTurn[] = [
        ...history,
        { role: "user", text: message, createdAt: new Date().toISOString() },
        { role: "model", text: modelReply, createdAt: new Date().toISOString() },
      ];
      await this.database.client.chatSession.update({ where: { id: session.id }, data: { history: updatedHistory as unknown as Prisma.InputJsonValue } });

      // Notify admin of new customer AI-chat message (WhatsApp-style: always notify the other side)
      sendNotificationToAdmin(
        fashionHouseId,
        customerUser?.name || "Customer",
        message.slice(0, 100),
        { screen: "messages", customerId }
      );

      return {
        type: "message",
        reply: modelReply,
        availableSlots: fh.availableSlots.map((slot: any) => ({
          id: slot.id,
          label: `${slot.date} · ${slot.time}`,
        })),
      };
    } catch (err) {
      throw err;
    }
  }

  async postEscalate(input: ChatInput<"postEscalate">) {
    try {
      const { fashionHouseId: rawParam, reason, summary } = input.body;
      const authUserId = input.authUserId!;
      const { sessionCustomerId, fashionHouseId, role } = await this.resolveSessionTarget(rawParam || "default", authUserId);
      if (role !== "customer") {
        return rejectRequest({ error: "Only customers can request a human handoff." }, 403);
      }
      const fashionHouseExists = await this.database.client.fashionHouse.findUnique({
        where: { id: fashionHouseId },
        select: { id: true },
      });
      if (!fashionHouseExists) return rejectRequest({ error: "Fashion house not found" }, 404);

      const session = await this.database.client.chatSession.upsert({
        where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
        update: {},
        create: { customerId: sessionCustomerId, fashionHouseId, history: [] },
      });
      const history = (session?.history as unknown as ChatTurn[]) ?? [];
      const reply = "I've passed your request to the fashion house team. Continue in Human Chat for direct assistance.";
      const escalation = await this.activateHumanHandoff({
        sessionId: session.id,
        fashionHouseId,
        customerId: sessionCustomerId,
        history,
        reason: reason || "Customer requested human assistant",
        summary: summary || "Manual customer chat escalation",
        reply,
      });

      return { success: true, type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reply, escalation };
    } catch (err) {
      throw err;
    }
  }

  private async resolveSessionTarget(paramId: string, authUserId: string) {
    const user = await this.database.client.user.findUnique({ where: { id: authUserId } });
    if (!user) throw new Error("User not found");

    if (user.role === "admin") {
      const ownedFh = await this.database.client.fashionHouse.findUnique({ where: { adminId: user.id } });
      const fhId = ownedFh ? ownedFh.id : paramId;
      const targetUserId = paramId && paramId !== "default" ? paramId : authUserId;
      return { sessionCustomerId: targetUserId, fashionHouseId: fhId, role: user.role };
    } else if (user.role === "staff") {
      if (!user.fashionHouseId) {
        throw Object.assign(new Error("Your account is not associated with a fashion house. Contact your admin."), { status: 403 });
      }
      return { sessionCustomerId: user.id, fashionHouseId: user.fashionHouseId, role: user.role };
    } else {
      let fhId = paramId;
      if (fhId === "default") {
        const firstFh = await this.database.client.fashionHouse.findFirst();
        fhId = firstFh ? firstFh.id : paramId;
      }
      return { sessionCustomerId: user.id, fashionHouseId: fhId, role: user.role };
    }
  }

  private async activateHumanHandoff(input: ActivateHumanHandoffInput) {
    const activeKey = `${input.fashionHouseId}:${input.customerId}`;
    const transcript = input.triggerMessage
      ? [...input.history, { role: "user" as const, text: input.triggerMessage }]
      : input.history;
    const existing = await this.database.client.chatEscalation.findUnique({ where: { activeKey } });
    if (existing) return existing;

    let escalation;
    try {
      escalation = await this.database.client.$transaction(async (transaction) => {
        const created = await transaction.chatEscalation.create({
          data: {
            fashionHouseId: input.fashionHouseId,
            customerId: input.customerId,
            reason: input.reason,
            summary: input.summary,
            transcript: JSON.stringify(transcript),
            status: "pending",
            activeKey,
          },
        });
        const updatedHistory: ChatTurn[] = [
          ...transcript,
          { role: "model", text: input.reply },
          { role: "model", text: "--- Chat Session Ended ---" },
        ];
        await transaction.chatSession.update({
          where: { id: input.sessionId },
          data: { history: updatedHistory as unknown as Prisma.InputJsonValue },
        });
        return created;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const racedEscalation = await this.database.client.chatEscalation.findUnique({ where: { activeKey } });
      if (!racedEscalation) throw error;
      return racedEscalation;
    }

    sendNotificationToAdmin(
      input.fashionHouseId,
      "Customer Escalation Request",
      "A customer requested direct assistance."
    );
    return escalation;
  }
}

