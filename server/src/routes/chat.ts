import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendChatMessageSchema } from "../schemas/chat.schema";
import { getModel, buildSystemPrompt } from "../lib/gemini";
import { buildTruncatedHistory, shouldForceEscalate } from "../lib/chatHistory";
import { checkMessageGuardrails } from "../lib/chatGuardrails";
import rateLimit from "express-rate-limit";

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

type ChatTurn = { role: "user" | "model"; text: string };

// GET /api/chat/session/:fashionHouseId — load existing session history on screen open
router.get("/session/:fashionHouseId", async (req, res, next) => {
  try {
    const { fashionHouseId } = req.params;
    const customerId = req.authUserId!;

    const session = await prisma.chatSession.findUnique({
      where: { customerId_fashionHouseId: { customerId, fashionHouseId } },
    });

    res.json({ history: (session?.history as ChatTurn[]) ?? [] });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat/message — send a message; history is fully managed server-side
router.post("/message", chatLimiter, validate({ body: sendChatMessageSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId, message } = req.body;
    const customerId = req.authUserId!;

    // 1. Load or create server-side session (history never comes from client)
    const session = await prisma.chatSession.upsert({
      where: { customerId_fashionHouseId: { customerId, fashionHouseId } },
      update: {},
      create: { customerId, fashionHouseId, history: [] },
    });
    const history = (session.history as ChatTurn[]) ?? [];

    // 2. Cheap deterministic checks BEFORE spending an API call
    const guardrail = checkMessageGuardrails(message);
    if (guardrail.blocked) {
      return res.json({ type: "escalated", reason: guardrail.reason, reply: "I'll pass this along to the team directly — they'll follow up with you shortly." });
    }

    // 3. Server-enforced turn cap
    if (shouldForceEscalate(history)) {
      await createEscalation(fashionHouseId, customerId, history, "max_turns_exceeded");
      // Clear session after escalation so customer can start fresh
      await prisma.chatSession.update({ where: { id: session.id }, data: { history: [] } });
      return res.json({ type: "escalated", reason: "max_turns_exceeded", reply: "Let me get someone from the team to help you directly with this." });
    }

    // 4. Real context — never let the model invent catalog items or slots
    //    Verify fashionHouseId from the client actually exists (prevents enumeration/data leak)
    const fh = await prisma.fashionHouse.findUnique({
      where: { id: fashionHouseId },
      include: { catalogItems: { take: 5 }, availableSlots: { where: { booked: false }, take: 10 } },
    });
    if (!fh) return res.status(404).json({ error: "Fashion house not found" });

    const catalogSummary = fh.catalogItems.map((c: any) => c.name).join(", ") || "no items listed yet";
    const availableSlots = fh.availableSlots.map((s: any) => `${s.date} ${s.time}`);
    const systemPrompt = buildSystemPrompt({ fashionHouseName: fh.shopName, catalogSummary, availableSlots, currentDate: new Date().toISOString().split("T")[0] });

    // 5. Use server-side history (truncated to recent turns)
    const truncatedHistory = buildTruncatedHistory(history);

    const model = getModel();
    const chat = model.startChat({
      history: truncatedHistory.map((t: ChatTurn) => ({ role: t.role, parts: [{ text: t.text }] })),
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const functionCall = response.functionCalls()?.[0];

    // 6. Only TWO outcomes are ever written to the database
    if (functionCall?.name === "create_booking") {
      const args = functionCall.args as { styleNotes: string; preferredDate: string; preferredTime: string };
      const booking = await prisma.booking.create({
        data: { fashionHouseId, customerId, styleNotes: args.styleNotes, preferredDate: new Date(args.preferredDate), preferredTime: args.preferredTime, status: "pending_admin_review" },
      });
      // Clear session after successful booking so customer can start fresh
      await prisma.chatSession.update({ where: { id: session.id }, data: { history: [] } });
      return res.json({ type: "booking_created", booking });
    }

    if (functionCall?.name === "escalate_to_admin") {
      const args = functionCall.args as { reason: string; conversationSummary: string };
      await createEscalation(fashionHouseId, customerId, history, args.reason, args.conversationSummary);
      // Clear session after escalation
      await prisma.chatSession.update({ where: { id: session.id }, data: { history: [] } });
      return res.json({ type: "escalated", reason: args.reason, reply: "I've flagged this for the team — they'll follow up with you directly." });
    }

    // 7. Save the new exchange to DB (user message + model reply)
    const modelReply = response.text();
    const updatedHistory: ChatTurn[] = [
      ...history,
      { role: "user", text: message },
      { role: "model", text: modelReply },
    ];
    await prisma.chatSession.update({ where: { id: session.id }, data: { history: updatedHistory } });

    res.json({ type: "message", reply: modelReply });
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
