import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import authRouter from "@/routes/auth";
import staffRouter from "@/routes/staff";
import chatRouter from "@/routes/chat";
import escalationsRouter from "@/routes/escalations";
import uploadRouter from "@/routes/upload";
import sketchesRouter from "@/routes/sketches";
import { errorHandler } from "@/middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRouter);
app.use("/api/staff", staffRouter);
app.use("/api/chat", chatRouter);
app.use("/api/escalations", escalationsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/sketches", sketchesRouter);

app.use(errorHandler);
