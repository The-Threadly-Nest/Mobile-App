import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { credentialVersion } from "../lib/session";

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
      authEmail?: string;
      authRole?: "admin" | "staff" | "customer";
      authFashionHouseId?: string | null;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
    const decoded = jwt.verify(header.slice(7), secret, { algorithms: ["HS256"] }) as {
      sub: string;
      email: string;
      role: string;
      fashionHouseId?: string;
      credentialVersion?: string;
    };
    if (typeof decoded.sub !== "string" || !decoded.credentialVersion) {
      return res.status(401).json({ error: "Please log in again." });
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, active: true, passwordHash: true,
        fashionHouseId: true, fashionHouseOwned: { select: { id: true } } },
    });
    if (!user?.active || !["admin", "staff", "customer"].includes(user.role) ||
        decoded.role !== user.role ||
        decoded.credentialVersion !== credentialVersion(user.id, user.passwordHash, secret)) {
      return res.status(401).json({ error: "Please log in again." });
    }
    req.authUserId = user.id;
    req.authEmail = user.email;
    req.authRole = user.role as "admin" | "staff" | "customer";
    req.authFashionHouseId = user.role === "admin"
      ? user.fashionHouseOwned?.id ?? null
      : user.role === "staff" ? user.fashionHouseId : null;
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    next(err);
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

/**
 * Returns the current house resolved from the database by requireAuth.
 */
export function getOwnFashionHouseId(req: Request): string {
  if (req.authRole !== "admin" && req.authRole !== "staff") {
    throw Object.assign(new Error("Fashion house access required."), { status: 403 });
  }
  const fhId = req.authFashionHouseId;
  if (!fhId) {
    throw Object.assign(
      new Error("Fashion house not found. Please log out and log in again to refresh your session."),
      { status: 404 }
    );
  }
  return fhId;
}
