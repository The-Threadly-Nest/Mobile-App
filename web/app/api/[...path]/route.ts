import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const route = path.join("/");
  const allowed = (request.method === "POST" && ["auth/login", "waitlist", "waitlist/verify", "waitlist/unsubscribe", "waitlist/admin/invite"].includes(route))
    || (request.method === "GET" && route === "waitlist/admin")
    || (request.method === "PATCH" && /^waitlist\/admin\/[a-f0-9-]{36}\/status$/.test(route));
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!process.env.API_BASE_URL) return NextResponse.json({ error: "We can't reach the waitlist right now. Please try again shortly." }, { status: 503 });
  try {
    const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, process.env.API_BASE_URL);
    target.search = new URL(request.url).search;
    const headers = new Headers({ "Content-Type": "application/json" });
    const authorization = request.headers.get("authorization");
    if (authorization) headers.set("Authorization", authorization);
    const result = await fetch(target, {
      method: request.method, headers, cache: "no-store", redirect: "error",
      body: request.method === "GET" ? undefined : await request.text(),
      signal: AbortSignal.timeout(50000),
    });
    return new Response(await result.text(), { status: result.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "We can't reach the waitlist right now. Please try again shortly." }, { status: 502 }); }
}

export { proxy as GET, proxy as POST, proxy as PATCH };
