import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRouter from "./routes/auth";
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
import { errorHandler } from "./middleware/errorHandler";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";

export const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${duration}ms)`
    );
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

app.use(errorHandler);
