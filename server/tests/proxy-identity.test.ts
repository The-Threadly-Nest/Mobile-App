import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
const { proxyIdentity } = require("../dist/src/core/http/proxy-identity");

test("authenticated proxy visitor identity", async (t) => {
  const names = ["WEB_PROXY_SECRET", "TRUST_RAILWAY_PROXY", "RAILWAY_ENVIRONMENT_ID"];
  const previous = Object.fromEntries(names.map(key => [key, process.env[key]]));
  process.env.WEB_PROXY_SECRET = "fixture-only".repeat(4);
  delete process.env.TRUST_RAILWAY_PROXY;
  t.after(() => { for (const key of names) if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; });
  function run(headers: Record<string, string>) {
    const req: any = { method: "POST", originalUrl: "/api/waitlist", ip: "127.0.0.1", get: (key: string) => headers[key] };
    let status = 200, next = false;
    const res: any = { status: (value: number) => { status = value; return res; }, json: () => res };
    proxyIdentity(req, res, () => { next = true; });
    return { ip: req.ip, status, next };
  }
  function signed(ip = "192.0.2.1", time = String(Date.now())) {
    return { "x-owuja-client-ip": ip, "x-owuja-proxy-time": time,
      "x-owuja-proxy-signature": createHmac("sha256", process.env.WEB_PROXY_SECRET!)
        .update(`${time}\nPOST\n/api/waitlist\n${ip}`).digest("hex") };
  }
  await t.test("valid signed identities remain distinct", () => {
    for (const ip of ["192.0.2.1", "192.0.2.2", "2001:db8::1"]) assert.deepEqual(run(signed(ip)), { ip, status: 200, next: true });
  });
  await t.test("spoofed, incomplete, expired and modified identities fail closed", () => {
    for (const headers of [
      { "x-owuja-client-ip": "192.0.2.1" },
      signed("192.0.2.1", String(Date.now() - 61000)),
      { ...signed(), "x-owuja-client-ip": "192.0.2.99" },
      { ...signed(), "x-owuja-proxy-signature": "bad" },
    ]) assert.deepEqual(run(headers), { ip: "127.0.0.1", status: 400, next: false });
  });
  await t.test("unconfigured direct forwarding headers are ignored", () => {
    assert.equal(run({ "x-forwarded-for": "192.0.2.1", "x-real-ip": "192.0.2.1" }).ip, "127.0.0.1");
  });
});
