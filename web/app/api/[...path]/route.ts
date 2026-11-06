import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 16 * 1024;
const RATE_HEADERS = ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset", "RateLimit", "RateLimit-Policy"];

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: NextRequest): Promise<string> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new Error("BODY_TOO_LARGE");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const route = path.join("/");
  const allowed = (request.method === "POST" && ["auth/login", "waitlist", "waitlist/unsubscribe", "waitlist/admin/invite"].includes(route))
    || (request.method === "GET" && ["waitlist/admin", "waitlist/stats"].includes(route))
    || (request.method === "PATCH" && /^waitlist\/admin\/[a-f0-9-]{36}\/status$/.test(route));
  if (!allowed) return failure("Not found.", 404);
  if (!process.env.API_BASE_URL) return failure("We can't reach the waitlist right now. Please try again shortly.", 503);
  const secret = process.env.WEB_PROXY_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    return failure("We can't reach the waitlist right now. Please try again shortly.", 503);
  }
  try {
    const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, process.env.API_BASE_URL);
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) throw new Error("INVALID_UPSTREAM");
    target.search = new URL(request.url).search;
    if (target.search.length > 2048) return failure("Please shorten your search and try again.", 400);
    const headers = new Headers({ "Content-Type": "application/json" });
    const authorization = request.headers.get("authorization");
    if (authorization) headers.set("Authorization", authorization);
    if (secret) {
      const railwayEdge = process.env.TRUST_RAILWAY_PROXY === "true" && Boolean(process.env.RAILWAY_ENVIRONMENT_ID);
      const ip = railwayEdge ? request.headers.get("x-real-ip") : "127.0.0.1";
      if (!ip || !isIP(ip) || (process.env.NODE_ENV === "production" && !railwayEdge)) {
        return failure("We couldn't validate this request. Please try again shortly.", 503);
      }
      const timestamp = String(Date.now());
      headers.set("x-owuja-client-ip", ip);
      headers.set("x-owuja-proxy-time", timestamp);
      headers.set("x-owuja-proxy-signature", createHmac("sha256", secret)
        .update(`${timestamp}\n${request.method}\n${target.pathname}${target.search}\n${ip}`).digest("hex"));
    }
    const body = request.method === "GET" ? undefined : await readBody(request);
    const response = await fetch(target, {
      method: request.method, headers, cache: "no-store", redirect: "error", body,
      signal: AbortSignal.timeout(15_000),
    });
    const responseHeaders = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
    for (const name of RATE_HEADERS) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    if (response.status >= 500) return failure("We couldn't complete your request. Please try again shortly.", response.status);
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") return failure("This request is too large. Please shorten your details and try again.", 413);
    return failure("We can't reach the waitlist right now. Please try again shortly.", 502);
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH };
