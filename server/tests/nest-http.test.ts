import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Test compiled code so Nest decorators run exactly as they do after a build.
// No real database queries, email, storage, or provider calls are made.
const { Module, Logger, RequestMethod, HttpException } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { PATH_METADATA, METHOD_METADATA, GUARDS_METADATA } = require("@nestjs/common/constants");
const { DatabaseService } = require("../dist/src/core/database/database.service");
const { SessionGuard, RolesGuard, PlatformAdminGuard } = require("../dist/src/core/auth/access.guards");
const { EndpointRateGuard } = require("../dist/src/core/http/endpoint-rate.guard");
const { EndpointInputPipe } = require("../dist/src/core/http/endpoint-input");
const { EndpointResultInterceptor, result, rejectRequest } = require("../dist/src/core/http/endpoint-result");
const { ApiExceptionFilter } = require("../dist/src/core/http/api-exception.filter");
const { collectionPage } = require("../dist/src/lib/pagination");
const { errorSummary } = require("../dist/src/core/logging");
const { readIdempotencyKey } = require("../dist/src/lib/idempotency");
const { credentialVersion } = require("../dist/src/lib/session");
const { catalogInputs } = require("../dist/src/modules/catalog/catalog.dto");
const { CatalogService } = require("../dist/src/modules/catalog/catalog.service");
const jwt = require("jsonwebtoken");

function moduleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? moduleFiles(join(dir, entry.name)) : [join(dir, entry.name)]);
}

test("Nest routes retain access checks, validation, response metadata, and upload handling", async (t) => {
  Logger.overrideLogger(false);
  const oldSecret = process.env.JWT_SECRET;
  const oldAdmins = process.env.PLATFORM_ADMIN_EMAILS;
  const secret = "isolated-test-secret-not-a-real-credential";
  process.env.JWT_SECRET = secret;
  process.env.PLATFORM_ADMIN_EMAILS = "owner@example.invalid";
  const houseId = "9d181de7-b80f-42e7-bdc3-4969251933d6";
  const user = (role: string) => ({ id: role, email: role === "admin" ? "owner@example.invalid" : `${role}@example.invalid`,
    role, active: true, passwordHash: "fixture-hash", emailVerifiedAt: new Date(), fashionHouseId: houseId,
    fashionHouseOwned: role === "admin" ? { id: houseId } : null });
  const token = (role: string) => jwt.sign({ sub: role, role, credentialVersion: credentialVersion(role, "fixture-hash", secret) }, secret);
  const rows = [{ id: "one", name: "First" }, { id: "two", name: "Second" }, { id: "three", name: "Third" }];
  let lastWhere: unknown;
  const database = { client: {
    user: { findUnique: async ({ where }: any) => ["admin", "staff", "customer"].includes(where.id) ? user(where.id) : null },
    catalogItem: {
      findMany: async (args: any) => { lastWhere = args.where; return rows; },
      create: async ({ data }: any) => ({ id: houseId, ...data }),
      findFirst: async ({ where }: any) => { lastWhere = where; return null; },
      findUnique: async () => null,
    },
  } };
  Object.assign(database, { identityClient: database.client });
  const controllers: any[] = [];
  const providers: any[] = [SessionGuard, RolesGuard, PlatformAdminGuard, EndpointRateGuard, { provide: DatabaseService, useValue: database }];
  const routes: { verb: string; url: string; guards: any[]; roles?: string[] }[] = [];
  for (const file of moduleFiles(resolve(__dirname, "../dist/src/modules")).filter((file) => file.endsWith(".controller.js"))) {
    const Controller = Object.values(require(file)).find((value: any) => typeof value === "function" && value.name.endsWith("Controller")) as any;
    const Service = Object.values(require(file.replace(".controller.js", ".service.js"))).find((value: any) => typeof value === "function" && value.name.endsWith("Service")) as any;
    controllers.push(Controller);
    const stub = Object.fromEntries(Object.getOwnPropertyNames(Service.prototype).filter((name) => name !== "constructor").map((name) => [name, async (input: any) => {
      if (name === "postParseVoice") return { receivedAudio: input.file?.buffer.length ?? 0 };
      return { endpoint: name, accepted: true };
    }]));
    providers.push({ provide: Service, useValue: Service === CatalogService ? new CatalogService(database) : stub });
    const prefix = Reflect.getMetadata(PATH_METADATA, Controller);
    for (const name of Object.getOwnPropertyNames(Controller.prototype)) {
      const handler = Controller.prototype[name];
      const verb = Reflect.getMetadata(METHOD_METADATA, handler);
      if (verb === undefined) continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler);
      routes.push({ verb: RequestMethod[verb], url: `/${prefix}/${path}`.replace(/\/$/, "").replace(/:[A-Za-z]+/g, houseId),
        guards: Reflect.getMetadata(GUARDS_METADATA, handler) ?? [], roles: Reflect.getMetadata("owuja.allowedRoles", handler) });
    }
  }
  class HttpFixture {}
  Module({ controllers, providers })(HttpFixture);
  const app = await NestFactory.create(HttpFixture, { logger: false, abortOnError: false });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new EndpointResultInterceptor());
  try {
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    const base = `http://127.0.0.1:${address.port}`;
    const send = (url: string, role?: string, body?: unknown, method = "GET") => fetch(base + url, {
      method, headers: { ...(role ? { Authorization: `Bearer ${token(role)}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    await t.test("all 87 current feature routes are registered and protected where expected", async () => {
      assert.equal(routes.length, 87);
      assert.equal((await send("/api/waitlist/verify", undefined, {}, "POST")).status, 404);
      for (const route of routes) {
        const response = await send(route.url, undefined, ["GET", "HEAD"].includes(route.verb) ? undefined : {}, route.verb);
        await response.text();
        if (route.guards.includes(SessionGuard)) assert.equal(response.status, 401, `${route.verb} ${route.url}`);
        else assert.notEqual(response.status, 404, `${route.verb} ${route.url}`);
      }
    });
    await t.test("pagination keeps the array body and paging headers", async () => {
      const response = await send("/api/catalog?page=1&limit=2", "admin");
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), rows.slice(0, 2));
      assert.equal(response.headers.get("X-Has-More"), "true");
      assert.equal(response.headers.get("X-Next-Page"), "2");
      assert.deepEqual(lastWhere, { fashionHouseId: houseId });
    });
    await t.test("create returns 201 and unknown fields cannot override the tenant", async () => {
      const response = await send("/api/catalog", "admin", { name: "Test shirt", imageUrl: "https://example.invalid/shirt.webp", fashionHouseId: "another-house" }, "POST");
      assert.equal(response.status, 201);
      assert.equal((await response.json() as any).fashionHouseId, houseId);
    });
    await t.test("customers cannot create catalog items", async () => {
      const response = await send("/api/catalog", "customer", { name: "Test shirt" }, "POST");
      assert.equal(response.status, 403);
      assert.match((await response.json() as any).error, /permission/);
    });
    await t.test("validation is readable and does not expose Zod internals", async () => {
      const response = await send("/api/catalog", "admin", {}, "POST");
      assert.equal(response.status, 400);
      const body = await response.json() as any;
      assert.match(body.error, /Please/);
      assert.ok(Array.isArray(body.issues));
      assert.doesNotMatch(body.error, /Zod|invalid_type|Expected|undefined/);
    });
    await t.test("lookup failures keep their status and tenant scope", async () => {
      const response = await send(`/api/catalog/${houseId}`, "admin", {}, "PATCH");
      assert.equal(response.status, 404);
      assert.deepEqual(lastWhere, { id: houseId, fashionHouseId: houseId });
      assert.equal((await response.json() as any).error, "Catalog item not found.");
    });
    await t.test("native multipart interceptor passes the uploaded file to the service", async () => {
      const form = new FormData();
      form.append("audio", new Blob(["audio-fixture"], { type: "audio/mp4" }), "voice.m4a");
      const response = await fetch(base + "/api/measurements/parse-voice", { method: "POST", headers: { Authorization: `Bearer ${token("admin")}` }, body: form });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as any).receivedAudio, 13);
    });
    await t.test("chat rate limiting runs after authentication and separates accounts", async () => {
      const first = await send("/api/chat/message", "customer", {}, "POST");
      assert.equal(first.headers.get("RateLimit-Remaining"), "29");
      await first.text();
      const second = await send("/api/chat/message", "admin", {}, "POST");
      assert.equal(second.headers.get("RateLimit-Remaining"), "29");
      await second.text();
    });
    await t.test("chat limits return a readable retry message and Retry-After", async () => {
      for (let attempt = 0; attempt < 29; attempt++) {
        const response = await send("/api/chat/message", "customer", {}, "POST");
        await response.text();
      }
      const response = await send("/api/chat/message", "customer", {}, "POST");
      assert.equal(response.status, 429);
      assert.ok(Number(response.headers.get("Retry-After")) > 0);
      assert.match((await response.json() as any).error, /Please wait/);
    });
    await t.test("platform administration is not granted to a customer", async () => {
      const response = await send("/api/waitlist/admin", "customer");
      assert.equal(response.status, 403);
      await response.text();
    });
    await t.test("an expired or invalid sign-in token returns a readable message", async () => {
      const response = await fetch(base + "/api/catalog", { headers: { Authorization: "Bearer not-a-valid-token" } });
      assert.equal(response.status, 401);
      assert.match((await response.json() as any).error, /Please log in again/);
    });
    await t.test("every feature route handles admin, staff, customer and anonymous requests without leaking internals", async (matrix) => {
      let requests = 0;
      for (const route of routes) {
        for (const role of [undefined, "admin", "staff", "customer"]) {
          // Each case tests authorization/validation, not exhaustion of a shared limiter.
          app.get(EndpointRateGuard).buckets.clear();
          const response = await send(route.url, role, ["GET", "HEAD"].includes(route.verb) ? undefined : {}, route.verb);
          const body = await response.text();
          requests++;
          const label = `${role ?? "anonymous"}: ${route.verb} ${route.url}`;
          assert.ok(response.status < 500, `${label}: unexpected HTTP ${response.status}`);
          assert.doesNotMatch(body, /PrismaClient|node_modules|\bat \w+.*\.(?:js|ts):\d+|postgres(?:ql)?:\/\//, label);
          if (route.guards.includes(SessionGuard)) {
            if (!role) assert.equal(response.status, 401, label);
            else if ((route.guards.includes(RolesGuard) && !route.roles?.includes(role)) ||
              (route.guards.includes(PlatformAdminGuard) && role !== "admin")) assert.equal(response.status, 403, label);
            else assert.notEqual(response.status, 401, label);
          }
        }
      }
      matrix.diagnostic(`${routes.length} routes × 4 identities = ${requests} HTTP contract checks. Services are mocked except catalog; not end-to-end business-flow coverage.`);
    });
  } finally {
    await app.close();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    if (oldAdmins === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = oldAdmins;
  }
});

test("server errors never expose configuration or provider details", () => {
  const filter = new ApiExceptionFilter();
  let status: number;
  let body: any;
  const response = { headersSent: false, status(value: number) { status = value; return this; }, json(value: unknown) { body = value; } };
  const host = { switchToHttp: () => ({ getRequest: () => ({ method: "POST", route: { path: "/api/example" } }), getResponse: () => response }) };
  filter.catch(new HttpException({ error: "GOOGLE_CLIENT_ID secret=do-not-display" }, 500), host);
  assert.equal(status!, 500);
  assert.match(body.error.message, /Please try again/);
  assert.doesNotMatch(JSON.stringify(body), /GOOGLE|secret|do-not-display/);
});

test("technical error summaries exclude error messages and credentials", () => {
  const error = Object.assign(new Error("postgres://user:password@host/database"), { code: "P2025" });
  assert.equal(errorSummary(error), "Error; code P2025.");
});

test("idempotency keys reject arrays and keep valid retry keys", () => {
  assert.equal(readIdempotencyKey({ "idempotency-key": "order:123" }), "order:123");
  assert.throws(() => readIdempotencyKey({ "idempotency-key": ["one", "two"] }));
});

test("the response result preserves no-content status and collection metadata", () => {
  assert.equal(result(undefined, 204).status, 204);
  assert.equal(collectionPage([1, 2, 3], 1, 2).headers["X-Next-Page"], "2");
  assert.throws(() => rejectRequest({ error: "Please try another time." }, 409), (error: any) => error.getStatus() === 409);
});

test("validation produces readable field errors", () => {
  const pipe = new EndpointInputPipe(catalogInputs.post);
  assert.throws(() => pipe.transform({ body: {}, query: {}, params: {}, headers: {} }), (error: any) => {
    assert.match(error.getResponse().error, /Please/);
    return true;
  });
});

test("booking errors are not swallowed by the assistant fallback", async (t) => {
  const { ChatService } = require("../dist/src/modules/messaging/chat.service");
  const modelModule = require("../dist/src/lib/gemini");
  const originalModel = modelModule.getModel;
  const failure = new Error("isolated booking database failure");
  const database = { client: {
    chatSession: { upsert: async () => ({ id: "session", history: [] }) },
    fashionHouse: { findUnique: async () => ({ id: "house", shopName: "Test house", categories: [], catalogItems: [], availableSlots: [], timezone: "Africa/Lagos" }) },
    chatEscalation: { findUnique: async () => null },
    user: { findUnique: async () => null },
    booking: { findFirst: async () => { throw failure; } },
  } };
  const service = new ChatService(database);
  service.resolveSessionTarget = async () => ({ sessionCustomerId: "customer", fashionHouseId: "house", role: "customer" });
  modelModule.getModel = () => ({ startChat: () => ({ sendMessage: async () => ({ response: {
    functionCalls: () => [{ name: "create_booking", args: { styleNotes: "Shirt", preferredDate: "2030-01-01", preferredTime: "10:00" } }],
    text: () => "",
  } }) }) });
  const input = { authUserId: "customer", authRole: "customer", body: { fashionHouseId: "house", message: "Book a fitting" }, headers: {}, params: {}, query: {} };
  try {
    await t.test("missing booking confirmation keys keep their actionable 400 response", async () => {
      await assert.rejects(service.postMessage(input), (error: any) => {
        assert.equal(error.getStatus(), 400);
        assert.equal(error.getResponse().code, "IDEMPOTENCY_KEY_REQUIRED");
        return true;
      });
    });
    await t.test("database failures propagate instead of returning a successful chat reply", async () => {
      await assert.rejects(service.postMessage({ ...input, headers: { "idempotency-key": "fixture:booking" } }), (error: unknown) => error === failure);
    });
  } finally {
    modelModule.getModel = originalModel;
  }
});
