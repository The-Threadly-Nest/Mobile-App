import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request, Response, NextFunction } from "express";

/** Only our signed web proxy or the explicitly configured Railway edge can set req.ip. */
export function proxyIdentity(req: Request, res: Response, next: NextFunction): void {
  const ip = req.get("x-owuja-client-ip");
  const timestamp = req.get("x-owuja-proxy-time");
  const signature = req.get("x-owuja-proxy-signature");
  if (ip || timestamp || signature) {
    const secret = process.env.WEB_PROXY_SECRET;
    if (!secret || !ip || !isIP(ip) || !timestamp || !/^\d{13}$/.test(timestamp)
      || Math.abs(Date.now() - Number(timestamp)) > 60_000 || !signature || !/^[a-f0-9]{64}$/.test(signature)) {
      res.status(400).json({ error: "We couldn't validate this request. Please try again." });
      return;
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}\n${req.method}\n${req.originalUrl}\n${ip}`).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
      res.status(400).json({ error: "We couldn't validate this request. Please try again." });
      return;
    }
    Object.defineProperty(req, "ip", { value: ip, configurable: true });
  } else if (process.env.TRUST_RAILWAY_PROXY === "true" && process.env.RAILWAY_ENVIRONMENT_ID) {
    // Railway's public edge overwrites X-Real-IP. Never enable this for a
    // deployment that accepts untrusted direct connections to the process.
    const edgeIp = req.get("x-real-ip");
    if (edgeIp && isIP(edgeIp)) Object.defineProperty(req, "ip", { value: edgeIp, configurable: true });
  }
  next();
}
