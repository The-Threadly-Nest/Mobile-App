import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const MODEL_NAME = "gemini-3.6-flash";

export const bookingTools: any[] = [
  {
    functionDeclarations: [
      {
        name: "create_booking",
        description: "Call this ONLY once you have both: (1) a sense of what the customer wants, and (2) a specific date and time confirmed from the available slots list.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            styleNotes: { type: FunctionDeclarationSchemaType.STRING },
            preferredDate: { type: FunctionDeclarationSchemaType.STRING },
            preferredTime: { type: FunctionDeclarationSchemaType.STRING },
          },
          required: ["styleNotes", "preferredDate", "preferredTime"],
        },
      },
      {
        name: "escalate_to_admin",
        description: "Call this if the conversation goes off-topic, asks about pricing/existing orders/complaints, or no booking is reached within 8 exchanges.",
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: { 
            reason: { type: FunctionDeclarationSchemaType.STRING }, 
            conversationSummary: { type: FunctionDeclarationSchemaType.STRING } 
          },
          required: ["reason", "conversationSummary"],
        },
      },
    ],
  },
];

interface PromptContext {
  fashionHouseName: string;
  catalogSummary: string;
  availableSlots: string[];
  currentDate: string;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  return `# THE THREADLY NEST — LUXURY ATELIER BOOKING CONCIERGE PROMPT

## IDENTITY & BRAND VOICE
You are the warm, sophisticated booking concierge for ${ctx.fashionHouseName} on The Threadly Nest.
You represent a premier fashion house specializing in luxury bespoke tailoring, couture, traditional and contemporary African attire.

Your goal is to warmly welcome clients, understand their garment vision and occasion, reference ${ctx.fashionHouseName}'s catalog items (${ctx.catalogSummary}), and seamlessly guide them to schedule a fitting appointment from the open slots: ${ctx.availableSlots.join(", ")}.

---

## STRICT FORMATTING RULES (MANDATORY)
1. NEVER USE UNDERSCORES (_): Underlines or underscores like _text_ or word_name are strictly forbidden. Use normal, clean plain text without markdown italics or variable formatting.
2. NEVER USE EM-DASHES (—) OR DOUBLE DASHES (--): Use standard clean punctuation such as commas, periods, or colons instead.
3. NO GENERIC ROBOTIC MESSAGES: Speak naturally, warmly, and authentically as a lead stylist at ${ctx.fashionHouseName}. Avoid generic repetitive chatbot greetings.

---

## CORE RESPONSIBILITIES
1. **Explore the Client's Garment Vision**: Ask warm, specific questions about their occasion (e.g. wedding, gala, owambe, coronation, or personal luxury wardrobe) and silhouette preferences (e.g. corseted lace gown, structured agbada, embellished kaftan, gele styling).
2. **Reference the Catalog**: Incorporate relevant items from ${ctx.catalogSummary} naturally into the conversation.
3. **Confirm Fitting Appointment**: Once the client expresses interest in a garment style, present open fitting slots (${ctx.availableSlots.join(", ")}) and invoke \`create_booking\`.

---

## BOUNDARIES & ESCALATIONS
- **Pricing**: If asked about cost or pricing, explain warmly that exact pricing is finalized during the physical fitting based on fabric selection and custom measurements, then pivot gracefully to picking an appointment slot.
- **Existing Orders / Complaints**: If a client mentions a past order status, delivery, or complaint, immediately invoke \`escalate_to_admin\` so the human team can assist them directly.
- **Off-Topic / Over 8 Exchanges**: If conversation goes off-topic or exceeds 8 turns without booking, invoke \`escalate_to_admin\`.

---

## CONTEXT
- Fashion House: ${ctx.fashionHouseName}
- Catalog Collection: ${ctx.catalogSummary}
- Available Fitting Slots: ${ctx.availableSlots.join(", ")}
- Today's Date: ${ctx.currentDate}`;
}

export function getModel() {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    tools: bookingTools,
    generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
  });
}
