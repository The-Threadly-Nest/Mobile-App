import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { MeasurementsInput } from "./measurements.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { assertAudioContent } from "../../core/http/audio-validation";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

// GET /api/measurements/my-measurements — Customer fetch own measurements

// GET /api/measurements/check/:customerName — Admin check if customer has measurements recorded

// Multer — store audio in memory (no disk writes needed)

// Add Measurement (Single or Sheet)

// List Measurements for Customer

// ─── AI Voice Parser ────────────────────────────────────────────────────────
//
// Accepts a multipart/form-data POST with field "audio" (the recorded file).
// Sends the audio inline to Gemini Flash which both transcribes and extracts
// structured measurement fields in one pass.
//

@Injectable()
export class MeasurementsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async getMyMeasurements(input: MeasurementsInput<"getMyMeasurements">) {

    const userId = input.authUserId!;
    const measurements = await this.database.client.measurement.findMany({
      where: { customer: { userId } },
      orderBy: { recordedAt: "desc" },
    });

    return measurements;

  }

  async getCheckByCustomerName(input: MeasurementsInput<"getCheckByCustomerName">) {

    const fhId = getOwnFashionHouseId(input);
    const customer = await this.database.client.customer.findFirst({
      where: { name: { equals: routeParam(input, "customerName"), mode: "insensitive" }, fashionHouseId: fhId },
      include: { measurements: true },
    });
    const hasMeasurements = customer ? customer.measurements.length > 0 : false;
    return { hasMeasurements, count: customer?.measurements.length || 0, customerId: customer?.id || null };

  }

  async post(input: MeasurementsInput<"post">) {

    const fhId = getOwnFashionHouseId(input);
    const { customerId, customerName, field, value, unit, standard, custom } = input.body;

    let targetCustomerId = customerId;
    if (!targetCustomerId && customerName) {
      let customer = await this.database.client.customer.findFirst({
        where: { name: { equals: customerName, mode: "insensitive" }, fashionHouseId: fhId },
      });
      if (!customer) {
        customer = await this.database.client.customer.create({
          data: { name: customerName, fashionHouseId: fhId },
        });
      }
      targetCustomerId = customer.id;
    }

    if (!targetCustomerId) {
      return rejectRequest({ error: "Please select a customer or enter their name." }, 400);
    }

    const ownedCustomer = await this.database.client.customer.findFirst({
      where: { id: targetCustomerId, fashionHouseId: fhId }, select: { id: true },
    });
    if (!ownedCustomer) return rejectRequest({ error: "Customer not found." }, 404);

    // Bulk sheet save (e.g. from Admin Measurement Capture form)
    if (standard && typeof standard === "object") {
      const created = [];
      for (const [fKey, fVal] of Object.entries(standard)) {
        if (fVal && !isNaN(Number(fVal))) {
          const m = await this.database.client.measurement.create({
            data: { customerId: targetCustomerId, field: fKey, value: Number(fVal), unit: unit || "in" },
          });
          created.push(m);
        }
      }
      if (Array.isArray(custom)) {
        for (const item of custom as any[]) {
          if (item.label && item.value && !isNaN(Number(item.value))) {
            const m = await this.database.client.measurement.create({
              data: { customerId: targetCustomerId, field: item.label, value: Number(item.value), unit: unit || "in" },
            });
            created.push(m);
          }
        }
      }
      return result({ success: true, count: created.length, measurements: created }, 201);
    }

    if (!field || value === undefined) {
      return rejectRequest({ error: "Measurement field and value are required." }, 400);
    }

    const measurement = await this.database.client.measurement.create({
      data: {
        customerId: targetCustomerId,
        field,
        value: Number(value),
        unit: unit || "in",
      },
    });

    return result(measurement, 201);

  }

  async getCustomerByCustomerId(input: MeasurementsInput<"getCustomerByCustomerId">) {

    const fhId = getOwnFashionHouseId(input);
    const customerId = routeParam(input, "customerId");

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await this.database.client.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return rejectRequest({ error: "Customer not found in your fashion house." }, 404);
    }

    const measurements = await this.database.client.measurement.findMany({
      where: { customerId },
      orderBy: { recordedAt: "desc" },
    });

    return measurements;

  }

  async postParseVoice(input: MeasurementsInput<"postParseVoice">) {

    if (!input.file) {
      return rejectRequest({ error: "Please record or select an audio file first." }, 400);
    }

    assertAudioContent(input.file);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: { temperature: 0, maxOutputTokens: 512 },
    });

    const audioBase64 = input.file.buffer.toString("base64");
    const mimeType = (input.file.mimetype || "audio/m4a") as any;

    const prompt = `You are a garment measurement extraction assistant for a fashion atelier.
Your ONLY job is to extract explicitly stated body measurements from this audio clip.

STRICT RULES:
1. ONLY extract a field if the speaker EXPLICITLY names it AND states a numeric value.
   Valid: "Bust is 36", "Waist 29 inches", "sleeve length twenty-two"
   Invalid: "Let me just check..." or "She has a great figure" — ignore these completely.
2. If a field is not clearly mentioned with a number, DO NOT include it.
3. Convert spoken numbers to digits: "thirty-six" → "36", "twenty nine" → "29".
4. Ignore all filler words, opinions, customer names, jargon, and non-measurement speech.
5. Output ONLY a single valid JSON object — no markdown, no explanation, no extra text.

Valid keys: bust, waist, hip, shoulder, sleeveLength, inseam
All values must be numeric strings (digits only, e.g. "36" not "36 inches").

Example output: {"bust":"36","waist":"29","hip":"40","shoulder":"15","sleeveLength":"22","inseam":"31"}
If no valid measurements are found, output exactly: {}`;

    const result = await model.generateContent([
      { inlineData: { mimeType, data: audioBase64 } },
      { text: prompt },
    ]);

    const rawText = result.response.text().trim();

    // ── Extraction strategy 1: pull the first {...} block from the output ──
    const jsonBlockMatch = rawText.match(/\{[^{}]*\}/s);
    const jsonText = jsonBlockMatch
      ? jsonBlockMatch[0]
      : rawText.replace(/^```(?:json)?|```$/gm, "").trim();

    const allowed = ["bust", "waist", "hip", "shoulder", "sleeveLength", "inseam"];
    let measurements: Record<string, string> = {};

    try {
      const parsed = JSON.parse(jsonText);
      for (const key of allowed) {
        const v = parsed[key];
        if ((typeof v === "number" || typeof v === "string") && /^\d+(?:\.\d+)?$/.test(String(v)) && Number(v) > 0 && Number(v) <= 1000) {
          measurements[key] = String(v);
        }
      }
    } catch {
      // ── Extraction strategy 2: regex — handles both plain numbers and "quoted" numbers ──
      const extractNum = (text: string, keywords: string[]): string | null => {
        for (const kw of keywords) {
          // Matches:  bust 36 | bust: 36 | bust: "36" | bust is 36
          const regex = new RegExp(
            `${kw}[\\w]*\\s*(?:is|=|:)?\\s*"?(\\d+(?:\\.\\d+)?)`,
            "i"
          );
          const match = text.match(regex);
          if (match?.[1]) return match[1];
        }
        return null;
      };
      const bust = extractNum(rawText, ["bust", "chest"]);
      const waist = extractNum(rawText, ["waist"]);
      const hip = extractNum(rawText, ["hip"]);
      const shoulder = extractNum(rawText, ["shoulder"]);
      const sleeve = extractNum(rawText, ["sleeveLength", "sleeve"]);
      const inseam = extractNum(rawText, ["inseam", "inside.?leg"]);
      if (bust) measurements.bust = bust;
      if (waist) measurements.waist = waist;
      if (hip) measurements.hip = hip;
      if (shoulder) measurements.shoulder = shoulder;
      if (sleeve) measurements.sleeveLength = sleeve;
      if (inseam) measurements.inseam = inseam;
    }

    return { success: true, transcript: rawText, measurements };

  }

}

