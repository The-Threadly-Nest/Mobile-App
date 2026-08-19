import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status ?? 500;
  if (status === 500) console.error("Unhandled error:", err);
  res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
}
