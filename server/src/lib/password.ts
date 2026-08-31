import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateResetToken(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let token = "";
  for (let i = 0; i < 4; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    token += chars.charAt(randomIndex);
  }
  return token;
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token.toUpperCase().trim()).digest("hex");
}
