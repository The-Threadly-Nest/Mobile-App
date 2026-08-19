import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authEmail?: string;
      authRole?: "admin" | "staff" | "customer";
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }
  try {
    const decoded = jwt.verify(header.slice(7), secret) as { sub: string; email: string; role: string };
    req.authUserId = decoded.sub;
    req.authEmail = decoded.email;
    req.authRole = decoded.role as "admin" | "staff" | "customer";
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...allowed: Array<"admin" | "staff" | "customer">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authRole || !allowed.includes(req.authRole)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    next();
  };
}
