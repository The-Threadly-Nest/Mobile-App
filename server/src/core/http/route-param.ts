import { BadRequestException } from "@nestjs/common";

/** These API routes use named scalar parameters, never wildcard arrays. */
export function routeParam(req: { params: Record<string, string> }, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new BadRequestException({ error: "We couldn't open that item. Please go back and select it again." });
  }
  return value;
}
