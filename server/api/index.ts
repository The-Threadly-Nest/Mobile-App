import type { Request, Response } from "express";
import { createApplication } from "../src/app";

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const app = await createApplication();
    app.getHttpAdapter().getInstance()(req, res);
  } catch {
    if (!res.headersSent) res.status(503).json({ error: "The service is temporarily unavailable." });
  }
}
