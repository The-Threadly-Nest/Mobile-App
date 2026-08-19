import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const MODEL_NAME = "gemini-2.5-flash";

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
  return `You are the booking assistant for ${ctx.fashionHouseName} on The Threadly Nest app. Your ONLY job is to:
1. Help the customer describe what they want (style, occasion, timeline)
2. Reference the sample catalog when relevant: ${ctx.catalogSummary}
3. Help the customer pick a real available slot
4. Once you have their style intent AND a confirmed date/time, call create_booking. Do not keep chatting after that.

STRICT BOUNDARIES:
- Never discuss price or negotiate cost — say the fashion house will confirm pricing at the appointment.
- Never discuss existing orders, order status, or complaints — call escalate_to_admin instead.
- If 8 exchanges pass without reaching a booking, call escalate_to_admin.
- Never invent availability. Only offer slots from this list: ${ctx.availableSlots.join(", ")}
- Today's date: ${ctx.currentDate}

Keep every response under 3 sentences.`;
}

export function getModel() {
  return genAI.getGenerativeModel({
    model: MODEL_NAME,
    tools: bookingTools,
    generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
  });
}
