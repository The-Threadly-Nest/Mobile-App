import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { manualChatEscalationSchema, sendChatMessageSchema } from "../schemas/chat.schema";
import { getModel, buildSystemPrompt } from "../lib/gemini";
import { buildTruncatedHistory, shouldForceEscalate, ChatTurn } from "../lib/chatHistory";
import { checkMessageGuardrails } from "../lib/chatGuardrails";
import rateLimit from "express-rate-limit";
import { sendNotificationToUser, sendNotificationToAdmin } from "../lib/notifications";
import { randomUUID } from "node:crypto";
import { isUniqueConstraintError, readIdempotencyKey } from "../lib/idempotency";
import { availableSlotClaimWhere } from "../lib/authorization";

const router = Router();
router.use(requireAuth);

// Per-user rate limit: max 30 chat messages per 10 minutes — prevents Gemini API bill abuse
const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.authUserId ?? req.ip ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages. Please wait a moment before continuing." },
});

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



async function resolveSessionTarget(paramId: string, authUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: authUserId } });
  if (!user) throw new Error("User not found");

  if (user.role === "admin") {
    const ownedFh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
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
      const firstFh = await prisma.fashionHouse.findFirst();
      fhId = firstFh ? firstFh.id : paramId;
    }
    return { sessionCustomerId: user.id, fashionHouseId: fhId, role: user.role };
  }
}

// GET /api/chat/session/:fashionHouseId — load existing session history on screen open
router.get("/session/:fashionHouseId", async (req, res, next) => {
  try {
    const rawParam = req.params.fashionHouseId;
    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId } = await resolveSessionTarget(rawParam, authUserId);

    const [session, availableSlots, activeEscalation] = await Promise.all([
      prisma.chatSession.findUnique({
        where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      }),
      prisma.availableSlot.findMany({
        where: { fashionHouseId, booked: false },
        orderBy: { date: "asc" },
        take: 10,
        select: { id: true, date: true, time: true },
      }),
      prisma.chatEscalation.findUnique({
        where: { activeKey: `${fashionHouseId}:${sessionCustomerId}` },
        select: { id: true, status: true },
      }),
    ]);

    const rawHistory = (session?.history as unknown as ChatTurn[]) ?? [];
    const { history, changed } = normalizeStoredHistory(rawHistory);
    if (session && changed) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { history: history as unknown as Prisma.InputJsonValue },
      });
    }

    res.json({
      history: visibleHistoryForUser(history, authUserId),
      availableSlots: availableSlots.map((slot) => ({
        id: slot.id,
        label: `${slot.date} · ${slot.time}`,
      })),
      conversationState: activeEscalation?.status ?? "automated",
      escalationId: activeEscalation?.id ?? null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/message — send a message; history is fully managed server-side
// Removes the message content for both participants when requested by its sender within ten minutes.
router.delete("/messages/:messageId", async (req, res, next) => {
  try {
    const rawParam = typeof req.body?.fashionHouseId === "string" ? req.body.fashionHouseId : "";
    if (!rawParam) return res.status(400).json({ error: "Conversation is required." });

    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId, role } = await resolveSessionTarget(
      rawParam,
      authUserId
    );
    const session = await prisma.chatSession.findUnique({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
    });
    if (!session) return res.status(404).json({ error: "Message not found." });

    const { history } = normalizeStoredHistory(
      (session.history as unknown as ChatTurn[]) ?? []
    );
    const messageIndex = history.findIndex((turn) => turn.id === req.params.messageId);
    if (messageIndex < 0) return res.status(404).json({ error: "Message not found." });

    const message = history[messageIndex];
    if (!ownsStoredTurn(message, authUserId, role)) {
      return res.status(403).json({ error: "You can only delete messages that you sent." });
    }
    if (message.deletedForEveryoneAt) {
      return res.json({ message, history: visibleHistoryForUser(history, authUserId) });
    }

    const sentAt = message.createdAt ? new Date(message.createdAt).getTime() : Number.NaN;
    if (!Number.isFinite(sentAt) || Date.now() - sentAt > 10 * 60 * 1000) {
      return res.status(400).json({ error: "This message can no longer be deleted for everyone." });
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

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { history: history as unknown as Prisma.InputJsonValue },
    });
    res.json({
      message: deletedMessage,
      history: visibleHistoryForUser(history, authUserId),
    });
  } catch (err) {
    next(err);
  }
});

// Hides a message only for the signed-in participant.
router.delete("/messages/:messageId/me", async (req, res, next) => {
  try {
    const rawParam = typeof req.body?.fashionHouseId === "string" ? req.body.fashionHouseId : "";
    if (!rawParam) return res.status(400).json({ error: "Conversation is required." });

    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId } = await resolveSessionTarget(rawParam, authUserId);
    const session = await prisma.chatSession.findUnique({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
    });
    if (!session) return res.status(404).json({ error: "Message not found." });

    const { history } = normalizeStoredHistory(
      (session.history as unknown as ChatTurn[]) ?? []
    );
    const messageIndex = history.findIndex((turn) => turn.id === req.params.messageId);
    if (messageIndex < 0) return res.status(404).json({ error: "Message not found." });

    const message = history[messageIndex];
    message.deletedForUserIds = Array.from(
      new Set([...(message.deletedForUserIds ?? []), authUserId])
    );

    await prisma.chatSession.update({
      where: { id: session.id },
      data: { history: history as unknown as Prisma.InputJsonValue },
    });
    res.json({ success: true, history: visibleHistoryForUser(history, authUserId) });
  } catch (err) {
    next(err);
  }
});

router.post("/message", chatLimiter, validate({ body: sendChatMessageSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId: rawParam, message, garmentName, imageUrl, audioUrl, audioDuration, availableSlotId } = req.body;
    const idempotencyKey = req.body.idempotencyKey || readIdempotencyKey(req);
    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId, role } = await resolveSessionTarget(rawParam, authUserId);
    const customerId = sessionCustomerId;

    // 1. Load or create server-side session
    const session = await prisma.chatSession.upsert({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      update: {},
      create: { customerId: sessionCustomerId, fashionHouseId, history: [] },
    });
    const { history } = normalizeStoredHistory(
      (session.history as unknown as ChatTurn[]) ?? []
    );

    const fashionHouseExists = await prisma.fashionHouse.findUnique({
      where: { id: fashionHouseId },
      select: { id: true },
    });
    if (!fashionHouseExists) return res.status(404).json({ error: "Fashion house not found" });

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
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { history: updatedHistory as unknown as Prisma.InputJsonValue },
      });

      // Fetch fashion house name for notification title
      const fhName = await prisma.fashionHouse.findUnique({
        where: { id: fashionHouseId },
        select: { shopName: true },
      }).then((fh) => fh?.shopName || "The Fashion House");

      // Send push notification asynchronously
      const notifBody = audioUrl ? "🎙️ Voice message received" : (message || "").slice(0, 100);
      if (role === "staff") {
        // Use the staff member's own name in the notification
        const staffName = await prisma.user.findUnique({
          where: { id: authUserId },
          select: { name: true },
        }).then((u) => u?.name || "A staff member");
        sendNotificationToAdmin(fashionHouseId, audioUrl ? `New Voice Note from ${staffName}` : `New Message from ${staffName}`, notifBody);
      } else {
        // Use the fashion house name when admin messages the customer
        sendNotificationToUser(sessionCustomerId, audioUrl ? `New Voice Note from ${fhName}` : `New Message from ${fhName}`, notifBody);
      }

      return res.json({ success: true, turn, history: visibleHistoryForUser(updatedHistory, authUserId) });
    }

    const activeEscalation = await prisma.chatEscalation.findUnique({
      where: { activeKey: `${fashionHouseId}:${customerId}` },
      select: { id: true, status: true },
    });
    if (activeEscalation) {
      return res.json({
        type: "human_active",
        conversationState: activeEscalation.status,
        escalationId: activeEscalation.id,
        reply: "Your request is already with the fashion house team. Continue in Human Chat for direct assistance.",
      });
    }

    // 2. Cheap deterministic checks BEFORE spending an API call
    const guardrail = checkMessageGuardrails(message);
    if (guardrail.blocked) {
      const reply = "I've passed this to the fashion house team. Continue in Human Chat for direct assistance.";
      const escalation = await activateHumanHandoff({
        sessionId: session.id,
        fashionHouseId,
        customerId,
        history,
        triggerMessage: message,
        reason: guardrail.reason,
        summary: "The automated assistant's safety rules required a human response.",
        reply,
      });
      return res.json({ type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reason: guardrail.reason, reply });
    }

    // 3. Server-enforced turn cap
    if (shouldForceEscalate(history)) {
      const reply = "I've passed this conversation to the fashion house team. Continue in Human Chat for direct assistance.";
      const escalation = await activateHumanHandoff({
        sessionId: session.id,
        fashionHouseId,
        customerId,
        history,
        triggerMessage: message,
        reason: "max_turns_exceeded",
        summary: "Conversation exceeded automated handling limits.",
        reply,
      });
      return res.json({ type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reason: "max_turns_exceeded", reply });
    }

    // 4. Real context — never let the model invent catalog items or slots
    //    Verify fashionHouseId from the client actually exists (prevents enumeration/data leak)
    const fh = await prisma.fashionHouse.findUnique({
      where: { id: fashionHouseId },
      include: {
        catalogItems: { take: 10, orderBy: { createdAt: "desc" } },
        availableSlots: { where: { booked: false }, take: 10, orderBy: { date: "asc" } },
      },
    });
    if (!fh) return res.status(404).json({ error: "Fashion house not found" });

    // Fetch customer's real name
    const customerUser = await prisma.user.findUnique({
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

    const availableSlots = fh.availableSlots.map((s: any) => `${s.date} · ${s.time}`);

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

    try {
      const model = getModel();
      const chat = model.startChat({
        history: truncatedHistory.map((t: ChatTurn) => ({ role: t.role, parts: [{ text: t.text }] })),
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      });

      const result = await chat.sendMessage(message);
      const response = result.response;
      const functionCall = response.functionCalls()?.[0];

      if (functionCall?.name === "create_booking") {
        const args = functionCall.args as { styleNotes: string; preferredDate: string; preferredTime: string; isFirstTime?: boolean };
        let booking = idempotencyKey
          ? await prisma.booking.findFirst({
              where: { customerId, idempotencyKey },
              include: { availableSlot: true },
            })
          : null;
        let bookingWasCreated = false;
        if (!booking) {
          if (!idempotencyKey) {
            return res.status(400).json({
              code: "IDEMPOTENCY_KEY_REQUIRED",
              error: "Please try selecting the fitting slot again.",
            });
          }
          if (!availableSlotId) {
            return res.status(400).json({
              code: "SLOT_REQUIRED",
              error: "Please select one of the available fitting slots.",
              availableSlots: fh.availableSlots.map((slot: any) => ({
                id: slot.id,
                label: `${slot.date} · ${slot.time}`,
              })),
            });
          }

          try {
            booking = await prisma.$transaction(async (transaction) => {
              const claimWhere = availableSlotClaimWhere(availableSlotId, fashionHouseId);
              const slot = await transaction.availableSlot.findFirst({ where: claimWhere });
              if (!slot) throw new SlotUnavailableError();

              const claimed = await transaction.availableSlot.updateMany({
                where: claimWhere,
                data: { booked: true },
              });
              if (claimed.count !== 1) throw new SlotUnavailableError();

              const preferredDate = new Date(`${slot.date}T00:00:00.000Z`);
              if (Number.isNaN(preferredDate.getTime())) {
                throw new Error("The selected fitting slot has an invalid date.");
              }

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
            booking = await prisma.booking.findFirst({
              where: { customerId, idempotencyKey },
              include: { availableSlot: true },
            });
            if (!booking && error instanceof SlotUnavailableError) {
              const freshSlots = await prisma.availableSlot.findMany({
                where: { fashionHouseId, booked: false },
                take: 10,
                orderBy: [{ date: "asc" }, { time: "asc" }],
              });
              return res.status(409).json({
                code: "SLOT_UNAVAILABLE",
                error: "That fitting slot was just taken. Please choose another available time.",
                availableSlots: freshSlots.map((slot) => ({
                  id: slot.id,
                  label: `${slot.date} · ${slot.time}`,
                })),
              });
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
          ? `${booking.availableSlot.date} at ${booking.availableSlot.time}`
          : args.preferredTime;
        const confirmReply = `Your fitting request with ${fh.shopName} for ${reservedSlotLabel} has been received! Our team will confirm shortly.`;
        const updatedHistory: ChatTurn[] = [
          ...history,
          { role: "user", text: message },
          { role: "model", text: confirmReply },
          { role: "model", text: "--- Chat Session Ended ---" },
        ];
        await prisma.chatSession.update({ where: { id: session.id }, data: { history: updatedHistory as unknown as Prisma.InputJsonValue } });
        return res.json({
          type: "booking_created",
          booking,
          reply: confirmReply,
        });
      }

      if (functionCall?.name === "escalate_to_admin") {
        const args = functionCall.args as { reason: string; conversationSummary: string };
        const escReply = "I've passed this to the fashion house team. Continue in Human Chat for direct assistance.";
        const escalation = await activateHumanHandoff({
          sessionId: session.id,
          fashionHouseId,
          customerId,
          history,
          triggerMessage: message,
          reason: args.reason,
          summary: args.conversationSummary,
          reply: escReply,
        });
        return res.json({ type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reason: args.reason, reply: escReply });
      }

      replyText = response.text() || "";
    } catch (aiErr) {
      console.warn("Gemini API call warning, using fast assistant fallback:", aiErr);
      replyText = `Wonderful! We would be honored to craft something exquisite for you at ${fh.shopName}. What garment style do you have in mind?`;
    }

    // Clean up response formatting
    let modelReply = (replyText || `Wonderful! We would be honored to craft something exquisite for you at ${fh.shopName}.`)
      .replace(/—/g, ", ")
      .replace(/--/g, ", ")
      .replace(/_/g, "")
      .replace(/atelier/gi, "Fashion House");

    const updatedHistory: ChatTurn[] = [
      ...history,
      { role: "user", text: message, createdAt: new Date().toISOString() },
      { role: "model", text: modelReply, createdAt: new Date().toISOString() },
    ];
    await prisma.chatSession.update({ where: { id: session.id }, data: { history: updatedHistory as unknown as Prisma.InputJsonValue } });

    // Notify admin of new customer AI-chat message (WhatsApp-style: always notify the other side)
    sendNotificationToAdmin(
      fashionHouseId,
      customerUser?.name || "Customer",
      message.slice(0, 100),
      { screen: "messages", customerId }
    );

    res.json({
      type: "message",
      reply: modelReply,
      availableSlots: fh.availableSlots.map((slot: any) => ({
        id: slot.id,
        label: `${slot.date} · ${slot.time}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/escalate — Direct customer-initiated chat escalation to Admin
router.post("/escalate", validate({ body: manualChatEscalationSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId: rawParam, reason, summary } = req.body;
    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId, role } = await resolveSessionTarget(rawParam || "default", authUserId);
    if (role !== "customer") {
      return res.status(403).json({ error: "Only customers can request a human handoff." });
    }
    const fashionHouseExists = await prisma.fashionHouse.findUnique({
      where: { id: fashionHouseId },
      select: { id: true },
    });
    if (!fashionHouseExists) return res.status(404).json({ error: "Fashion house not found" });

    const session = await prisma.chatSession.upsert({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      update: {},
      create: { customerId: sessionCustomerId, fashionHouseId, history: [] },
    });
    const history = (session?.history as unknown as ChatTurn[]) ?? [];
    const reply = "I've passed your request to the fashion house team. Continue in Human Chat for direct assistance.";
    const escalation = await activateHumanHandoff({
      sessionId: session.id,
      fashionHouseId,
      customerId: sessionCustomerId,
      history,
      reason: reason || "Customer requested human assistant",
      summary: summary || "Manual customer chat escalation",
      reply,
    });

    res.json({ success: true, type: "escalated", conversationState: escalation.status, escalationId: escalation.id, reply, escalation });
  } catch (err) {
    next(err);
  }
});

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

async function activateHumanHandoff(input: ActivateHumanHandoffInput) {
  const activeKey = `${input.fashionHouseId}:${input.customerId}`;
  const transcript = input.triggerMessage
    ? [...input.history, { role: "user" as const, text: input.triggerMessage }]
    : input.history;
  const existing = await prisma.chatEscalation.findUnique({ where: { activeKey } });
  if (existing) return existing;

  let escalation;
  try {
    escalation = await prisma.$transaction(async (transaction) => {
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
    const racedEscalation = await prisma.chatEscalation.findUnique({ where: { activeKey } });
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

export default router;
