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

    const session = await prisma.chatSession.findUnique({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
    });

    res.json({ history: (session?.history as unknown as ChatTurn[]) ?? [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/message — send a message; history is fully managed server-side
router.post("/message", chatLimiter, validate({ body: sendChatMessageSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId: rawParam, message, garmentName, audioUrl, audioDuration } = req.body;
    const authUserId = req.authUserId!;
    const { sessionCustomerId, fashionHouseId, role } = await resolveSessionTarget(rawParam, authUserId);
    const customerId = sessionCustomerId;

    // 1. Load or create server-side session
    const session = await prisma.chatSession.upsert({
      where: { customerId_fashionHouseId: { customerId: sessionCustomerId, fashionHouseId } },
      update: {},
      create: { customerId: sessionCustomerId, fashionHouseId, history: [] },
    });
    const history = (session.history as unknown as ChatTurn[]) ?? [];

    // 1b. If the sender is staff or admin, persist human chat message directly without invoking AI
    if (role === "staff" || role === "admin") {
      const turnRole = role === "admin" ? "admin" : "staff";
      const turnText = message?.trim() || (audioUrl ? "[Voice Note]" : "");
      const turn: any = { role: turnRole, text: turnText, createdAt: new Date().toISOString() };
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

      return res.json({ success: true, history: updatedHistory });
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

    const dbSlots = fh.availableSlots.map((s: any) => `${s.date} ${s.time}`);
    const availableSlots = dbSlots.length > 0 ? dbSlots : [
      "Sat, 6 Sep · 10:00 AM",
      "Sat, 6 Sep · 2:00 PM",
      "Mon, 8 Sep · 11:00 AM",
      "Tue, 9 Sep · 3:00 PM",
    ];

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
        const booking = await prisma.booking.create({
          data: {
            fashionHouseId,
            customerId,
            styleNotes: args.styleNotes,
            preferredDate: parsedDate,
            preferredTime: args.preferredTime,
            isFirstTime: args.isFirstTime ?? true,
            status: "pending_admin_review",
          },
        });
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

    res.json({ type: "message", reply: modelReply });
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
