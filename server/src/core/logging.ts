import { Logger } from "@nestjs/common";

export const appLogger = new Logger("Owuja");

/** Never log provider payloads, SQL parameters, tokens, or customer messages. */
export function errorSummary(error: unknown): string {
  if (!error || typeof error !== "object") return "No error details were provided.";
  const name = "name" in error && typeof error.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error.name) ? error.name : "Error";
  const code = "code" in error && typeof error.code === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(error.code) ? `; code ${error.code}` : "";
  return `${name}${code}.`;
}

export function logFailure(message: string, error: unknown): void {
  appLogger.warn(`${message} ${errorSummary(error)}`);
}
