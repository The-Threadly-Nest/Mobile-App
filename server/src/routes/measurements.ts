import { Router } from "express";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createMeasurementSchema } from "../schemas/measurements.schema";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

// Multer — store audio in memory (no disk writes needed)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Add Measurement
router.post("/", validate({ body: createMeasurementSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { customerId, field, value, unit } = req.body;

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found in your fashion house." });
    }

    const measurement = await prisma.measurement.create({
      data: {
        customerId,
        field,
        value,
        unit,
      },
    });

    res.status(201).json(measurement);
  } catch (err) {
    next(err);
  }
});

// List Measurements for Customer
router.get("/customer/:customerId", async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { customerId } = req.params;

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found in your fashion house." });
    }

    const measurements = await prisma.measurement.findMany({
      where: { customerId },
      orderBy: { recordedAt: "desc" },
    });

    res.json(measurements);
  } catch (err) {
    next(err);
  }
});

// ─── AI Voice Parser ────────────────────────────────────────────────────────
//
// Accepts a multipart/form-data POST with field "audio" (the recorded file).
// Sends the audio inline to Gemini Flash which both transcribes and extracts
// structured measurement fields in one pass.
//
router.post("/parse-voice", upload.single("audio"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "An audio file is required (field: 'audio')." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    const model = genAI.getGenerativeModel({
      model: "gemini-3.6-flash",
      generationConfig: { temperature: 0, maxOutputTokens: 512 },
    });

    const audioBase64 = req.file.buffer.toString("base64");
    const mimeType = (req.file.mimetype || "audio/m4a") as any;

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
    console.log("[parse-voice] Gemini raw output:", rawText);

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
        if (v !== undefined && v !== null && v !== "") {
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
      const bust     = extractNum(rawText, ["bust", "chest"]);
      const waist    = extractNum(rawText, ["waist"]);
      const hip      = extractNum(rawText, ["hip"]);
      const shoulder = extractNum(rawText, ["shoulder"]);
      const sleeve   = extractNum(rawText, ["sleeveLength", "sleeve"]);
      const inseam   = extractNum(rawText, ["inseam", "inside.?leg"]);
      if (bust)     measurements.bust         = bust;
      if (waist)    measurements.waist        = waist;
      if (hip)      measurements.hip          = hip;
      if (shoulder) measurements.shoulder     = shoulder;
      if (sleeve)   measurements.sleeveLength = sleeve;
      if (inseam)   measurements.inseam       = inseam;
    }

    res.json({ success: true, transcript: rawText, measurements });
  } catch (err) {
    next(err);
  }
});

export default router;
