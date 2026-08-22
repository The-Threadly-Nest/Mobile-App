import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { sendChatMessageSchema } from "../schemas/chat.schema";
import { getModel, buildSystemPrompt } from "../lib/gemini";
import { buildTruncatedHistory, shouldForceEscalate } from "../lib/chatHistory";
import { checkMessageGuardrails } from "../lib/chatGuardrails";

const router = Router();
router.use(requireAuth);

router.post("/message", validate({ body: sendChatMessageSchema }), async (req, res, next) => {
  try {
    const { fashionHouseId, message, history } = req.body;

    // 1. Cheap deterministic checks BEFORE spending an API call
    const guardrail = checkMessageGuardrails(message);
    if (guardrail.blocked) {
      return res.json({ type: "escalated", reason: guardrail.reason, reply: "I'll pass this along to the team directly — they'll follow up with you shortly." });
    }

    // 2. Server-enforced turn cap
    if (shouldForceEscalate(history)) {
      await createEscalation(fashionHouseId, req.authUserId!, history, "max_turns_exceeded");
      return res.json({ type: "escalated", reason: "max_turns_exceeded", reply: "Let me get someone from the team to help you directly with this." });
    }

    // 3. Real context — never let the model invent catalog items or slots
    const fh = await prisma.fashionHouse.findUnique({
      where: { id: fashionHouseId },
      include: { catalogItems: { take: 5 }, availableSlots: { where: { booked: false }, take: 10 } },
    });
    if (!fh) return res.status(404).json({ error: "Fashion house not found" });

    const catalogSummary = fh.catalogItems.map((c: any) => c.name).join(", ") || "no items listed yet";
    const availableSlots = fh.availableSlots.map((s: any) => `${s.date} ${s.time}`);
    const systemPrompt = buildSystemPrompt({ fashionHouseName: fh.shopName, catalogSummary, availableSlots, currentDate: new Date().toISOString().split("T")[0] });

    // 4. Truncate history server-side
    const truncatedHistory = buildTruncatedHistory(history);

    const model = getModel();
    const chat = model.startChat({
      history: truncatedHistory.map((t: any) => ({ role: t.role, parts: [{ text: t.text }] })),
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const functionCall = response.functionCalls()?.[0];

    // 5. Only TWO outcomes are ever written to the database
    if (functionCall?.name === "create_booking") {
      const args = functionCall.args as { styleNotes: string; preferredDate: string; preferredTime: string };
      const booking = await prisma.booking.create({
        data: { fashionHouseId, customerId: req.authUserId!, styleNotes: args.styleNotes, preferredDate: new Date(args.preferredDate), preferredTime: args.preferredTime, status: "pending_admin_review" },
      });
      return res.json({ type: "booking_created", booking });
    }

    if (functionCall?.name === "escalate_to_admin") {
      const args = functionCall.args as { reason: string; conversationSummary: string };
      await createEscalation(fashionHouseId, req.authUserId!, history, args.reason, args.conversationSummary);
      return res.json({ type: "escalated", reason: args.reason, reply: "I've flagged this for the team — they'll follow up with you directly." });
    }

    res.json({ type: "message", reply: response.text() });
  } catch (err) {
    next(err);
  }
});

async function createEscalation(fashionHouseId: string, customerId: string, history: any[], reason: string, summary?: string) {
  await prisma.chatEscalation.create({
    data: { fashionHouseId, customerId, reason, summary: summary ?? "Conversation exceeded automated handling limits.", transcript: JSON.stringify(history) },
  });
}

export default router;
