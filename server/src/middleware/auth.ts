import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

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

export async function getOwnFashionHouseId(userId: string, role: string): Promise<string> {
  if (role === "admin") {
    const admin = await prisma.user.findUnique({ where: { id: userId }, include: { fashionHouseOwned: true } });
    if (!admin || !admin.fashionHouseOwned) {
      throw Object.assign(new Error("Fashion house not found for this admin"), { status: 404 });
    }
    return admin.fashionHouseOwned.id;
  } else {
    const staff = await prisma.user.findUnique({ where: { id: userId } });
    if (!staff || !staff.fashionHouseId) {
      throw Object.assign(new Error("Fashion house not found for this staff member"), { status: 404 });
    }
    return staff.fashionHouseId;
  }
}
