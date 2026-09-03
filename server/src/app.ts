import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import staffRouter from "./routes/staff";
import chatRouter from "./routes/chat";
import escalationsRouter from "./routes/escalations";
import uploadRouter from "./routes/upload";
import sketchesRouter from "./routes/sketches";
import ordersRouter from "./routes/orders";
import measurementsRouter from "./routes/measurements";
import invoicesRouter from "./routes/invoices";
import catalogRouter from "./routes/catalog";
import slotsRouter from "./routes/slots";
import preferencesRouter from "./routes/preferences";
import moodboardRouter from "./routes/moodboard";
import fashionHousesRouter from "./routes/fashionHouses";
import { errorHandler } from "./middleware/errorHandler";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";

export const app = express();

// Disable 304 caching in development so every request returns fresh data
app.set("etag", false);

// Comprehensive Single-Line Logger (No emojis, no box borders)
app.use((req: any, res, next) => {
  const start = Date.now();
  const timeStr = new Date().toLocaleTimeString();

  let responseBody: any = null;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body: any) => {
    responseBody = body;
    return originalJson(body);
  };

  res.send = (body: any) => {
    if (!responseBody && typeof body === "string") {
      try {
        responseBody = JSON.parse(body);
      } catch {
        responseBody = body;
      }
    }
    return originalSend(body);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    const parts: string[] = [
      `[${timeStr}] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${duration}ms)`
    ];

    // Log Query Params if present
    if (req.query && Object.keys(req.query).length > 0) {
      parts.push(`Query: ${JSON.stringify(req.query)}`);
    }

    // Log Request Body
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitized = { ...req.body };
      if (sanitized.password) sanitized.password = "••••";
      parts.push(`Body: ${JSON.stringify(sanitized)}`);
    }

    // Log Response Summary
    if (responseBody) {
      if (Array.isArray(responseBody)) {
        const sampleTitles = responseBody
          .slice(0, 3)
          .map((i: any) => `"${i.title || i.name || i.id}"`)
          .filter(Boolean);
        const preview = sampleTitles.length > 0 ? ` (${sampleTitles.join(", ")})` : "";
        parts.push(`Result: ${responseBody.length} item${responseBody.length === 1 ? "" : "s"}${preview}`);
      } else if (typeof responseBody === "object") {
        if (responseBody.error) {
          parts.push(`Error: "${responseBody.error}"`);
        } else if (responseBody.fileUrl) {
          parts.push(`File: ${responseBody.fileUrl}`);
        } else if (responseBody.title || responseBody.name) {
          parts.push(`Item: "${responseBody.title || responseBody.name}"`);
        } else {
          parts.push(`Result: ${JSON.stringify(responseBody).slice(0, 120)}`);
        }
      } else {
        parts.push(`Result: ${String(responseBody).slice(0, 100)}`);
      }
    }

    console.log(parts.join(" | "));
  });

  next();
});

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/", (_req, res) =>
  res.json({
    name: "The Threadly Nest API",
    status: "ok",
    health: "/health",
    docs: "/api-docs",
  })
);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/staff", staffRouter);
app.use("/api/chat", chatRouter);
app.use("/api/escalations", escalationsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/sketches", sketchesRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/measurements", measurementsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/slots", slotsRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/moodboard", moodboardRouter);
app.use("/api/fashion-houses", fashionHousesRouter);

app.use(errorHandler);
