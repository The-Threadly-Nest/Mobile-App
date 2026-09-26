import type { Request } from "express";

export function readIdempotencyKey(req: Request): string | null {
  const value = req.header("Idempotency-Key")?.trim();
  if (!value) return null;
  if (value.length > 128 || !/^[A-Za-z0-9:_-]+$/.test(value)) {
    throw Object.assign(new Error("Invalid idempotency key."), { status: 400 });
  }
  return value;
}

export function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}
