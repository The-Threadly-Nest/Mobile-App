import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendChatMessageSchema } from "../schemas/chat.schema";
import { getModel, buildSystemPrompt } from "../lib/gemini";
import { buildTruncatedHistory, shouldForceEscalate, ChatTurn } from "../lib/chatHistory";
import { checkMessageGuardrails } from "../lib/chatGuardrails";
import rateLimit from "express-rate-limit";
import { sendNotificationToUser, sendNotificationToAdmin } from "../lib/notifications";
import { parseFittingDate } from "../utils/dateUtils";
import { randomUUID } from "node:crypto";
import { isUniqueConstraintError, readIdempotencyKey } from "../lib/idempotency";

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

    const [session, availableSlots] = await Promise.all([
      prisma.chatSession.findUnique({
        where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      }),
      prisma.availableSlot.findMany({
        where: { fashionHouseId, booked: false },
        orderBy: { date: "asc" },
        take: 10,
        select: { id: true, date: true, time: true },
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
    const { fashionHouseId: rawParam, message, garmentName, imageUrl, audioUrl, audioDuration } = req.body;
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

    // 2. Cheap deterministic checks BEFORE spending an API call
    const guardrail = checkMessageGuardrails(message);
    if (guardrail.blocked) {
      return res.json({ type: "escalated", reason: guardrail.reason, reply: "I'll pass this along to the team directly — they'll follow up with you shortly." });
    }

    // 3. Server-enforced turn cap
    if (shouldForceEscalate(history)) {
      await createEscalation(fashionHouseId, customerId, history, "max_turns_exceeded");
      // Clear session after escalation so customer can start fresh
      await prisma.chatSession.update({ where: { id: session.id }, data: { history: [] as unknown as Prisma.InputJsonValue } });
      return res.json({ type: "escalated", reason: "max_turns_exceeded", reply: "Let me get someone from the team to help you directly with this." });
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
        const parsedDate = parseFittingDate(args.preferredDate || args.preferredTime);
        let booking = idempotencyKey
          ? await prisma.booking.findFirst({ where: { customerId, idempotencyKey } })
          : null;
        if (!booking) {
          try {
            booking = await prisma.booking.create({
              data: {
                fashionHouseId,
                customerId,
                styleNotes: args.styleNotes,
                preferredDate: parsedDate,
                preferredTime: args.preferredTime,
                isFirstTime: args.isFirstTime ?? true,
                status: "pending_admin_review",
                idempotencyKey,
              },
            });
          } catch (error) {
            if (!idempotencyKey || !isUniqueConstraintError(error)) throw error;
            booking = await prisma.booking.findFirst({ where: { customerId, idempotencyKey } });
            if (!booking) throw error;
          }
        }
        const confirmReply = `Your fitting request with ${fh.shopName} for ${args.preferredTime} has been received! Our team will confirm shortly.`;
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
        await createEscalation(fashionHouseId, customerId, history, args.reason, args.conversationSummary);
        const escReply = "I've flagged this for the team, and someone will follow up with you directly.";
        const updatedHistory: ChatTurn[] = [
          ...history,
          { role: "user", text: message },
          { role: "model", text: escReply },
          { role: "model", text: "--- Chat Session Ended ---" },
        ];
        await prisma.chatSession.update({ where: { id: session.id }, data: { history: updatedHistory as unknown as Prisma.InputJsonValue } });
        return res.json({ type: "escalated", reason: args.reason, reply: escReply });
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
router.post("/escalate", async (req, res, next) => {
  try {
    const { fashionHouseId: rawParam, reason, summary } = req.body;
    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId } = await resolveSessionTarget(rawParam || "default", authUserId);

    const session = await prisma.chatSession.findUnique({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
    });
    const history = (session?.history as unknown as ChatTurn[]) ?? [];

    const escalation = await prisma.chatEscalation.create({
      data: {
        fashionHouseId,
        customerId: sessionCustomerId,
        reason: reason || "Customer requested human assistant",
        summary: summary || "Manual customer chat escalation",
        transcript: JSON.stringify(history),
      },
    });

    if (session) {
      const updatedHistory: ChatTurn[] = [
        ...history,
        { role: "model", text: "I've flagged your session for administrators. A team member will join this chat shortly." },
        { role: "model", text: "--- Chat Session Ended ---" },
      ];
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { history: updatedHistory as unknown as Prisma.InputJsonValue },
      });
    }

    sendNotificationToAdmin(fashionHouseId, "Customer Escalation Request", "A customer requested direct admin assistance.");
    res.status(201).json({ success: true, escalation });
  } catch (err) {
    next(err);
  }
});

async function createEscalation(fashionHouseId: string, customerId: string, history: ChatTurn[], reason: string, summary?: string) {
  await prisma.chatEscalation.create({
    data: { fashionHouseId, customerId, reason, summary: summary ?? "Conversation exceeded automated handling limits.", transcript: JSON.stringify(history) },
  });
}

export default router;
