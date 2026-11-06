import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";

test("public waitlist progress uses real registration totals with a 5000-space target", async () => {
  const { WaitlistService } = require("../dist/src/modules/waitlist/waitlist.service");
  for (const registered of [0, 1, 4999, 5000, 5001]) {
    const service = new WaitlistService({ identityClient: { waitlistEntry: { count: async () => registered } } });
    assert.deepEqual(await service.getStats(), { registered, capacity: 5000, remaining: Math.max(0, 5000 - registered) });
  }
});

const { WaitlistService } = require("../dist/src/modules/waitlist/waitlist.service");
const { joinWaitlistSchema } = require("../dist/src/schemas/waitlist.schema");
const mailer = require("../dist/src/lib/mailer");

test("redesigned waitlist signup", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousSend = mailer.sendWaitlistConfirmationEmail;
  process.env.JWT_SECRET = "waitlist-test-only-not-a-real-secret";
  let sent: any[] = [];
  mailer.sendWaitlistConfirmationEmail = async (message: any) => { sent.push(message); };
  t.after(() => {
    mailer.sendWaitlistConfirmationEmail = previousSend;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const payload = (extra: Record<string, unknown> = {}) => joinWaitlistSchema.parse({
    name: "Test Designer", email: " Designer@Example.invalid ", audience: "fashion_house",
    businessName: "Test Atelier", teamSize: "2-5 people", city: "Lagos", consent: true, ...extra,
  });
  function fixture(existing: any = null) {
    sent = [];
    const created: any[] = [];
    const updates: any[] = [];
    const store: any = {
      findUnique: async ({ where }: any) => where.email ? existing : null,
      create: async ({ data }: any) => { created.push(data); return { id: "fixture-id", ...data }; },
      update: async (args: any) => { updates.push(args); return args.data; },
    };
    return { service: new WaitlistService({ identityClient: { waitlistEntry: store } }), store, created, updates };
  }

  await t.test("saves designer details and returns a referral without verifying email", async () => {
    const { service, created, updates } = fixture();
    const response = await service.post({ body: payload() });
    assert.equal(response.status, 202);
    assert.equal(created[0].email, "designer@example.invalid");
    assert.equal(created[0].teamSize, "2-5 people");
    assert.equal(created[0].verifiedAt, undefined);
    assert.equal(created[0].verificationHash, undefined);
    assert.match(response.data.referralCode, /^[A-F0-9]{10}$/);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].unsubscribeToken);
    assert.ok(updates[0].data.confirmationSentAt instanceof Date);
  });
  await t.test("preserves shopper interests and ignores designer-only fields", async () => {
    const { service, created } = fixture();
    await service.post({ body: payload({ audience: "customer", interests: "Bridal, Aso-Ebi" }) });
    assert.equal(created[0].interests, "Bridal, Aso-Ebi");
    assert.equal(created[0].businessName, null);
    assert.equal(created[0].teamSize, null);
  });
  await t.test("duplicate or unsubscribed emails are not overwritten or mailed again", async () => {
    const { service, created, updates } = fixture({ status: "unsubscribed", referralCode: "PRIVATE" });
    const response = await service.post({ body: payload() });
    assert.equal(response.data.referralCode, undefined);
    assert.equal(created.length + updates.length + sent.length, 0);
  });
  await t.test("an existing registration with a sent welcome email is not mailed twice", async () => {
    const { service, created, updates } = fixture({ status: "waiting", confirmationSentAt: new Date() });
    await service.post({ body: payload() });
    assert.equal(created.length + updates.length + sent.length, 0);
  });
  await t.test("an unsent welcome email retries using saved details, not replacement signup details", async () => {
    const existing = { id: "saved-id", email: "saved@example.invalid", name: "Original Name", audience: "customer", referralCode: "SAVEDCODE", status: "waiting", confirmationSentAt: null, createdAt: new Date("2026-11-01T10:00:00Z") };
    const { service, created, updates } = fixture(existing);
    const response = await service.post({ body: payload() });
    assert.equal(created.length, 0);
    assert.equal(sent[0].to, existing.email);
    assert.equal(sent[0].name, existing.name);
    assert.equal(sent[0].audience, "customer");
    assert.equal(sent[0].referralCode, existing.referralCode);
    assert.equal(sent[0].idempotencyKey, "waitlist-welcome/saved-id");
    assert.equal(updates.length, 1);
    assert.equal(response.data.referralCode, undefined);
    const token = sent[0].unsubscribeToken;
    await service.post({ body: payload() });
    assert.equal(sent[1].unsubscribeToken, token);
  });
  await t.test("email failures keep the registration and leave it eligible for retry", async () => {
    const { service, created, updates } = fixture();
    const send = mailer.sendWaitlistConfirmationEmail;
    mailer.sendWaitlistConfirmationEmail = async () => { throw Object.assign(new Error("private provider error"), { code: "EMAIL_PROVIDER_403" }); };
    try {
      const response = await service.post({ body: payload() });
      assert.equal(response.status, 202);
      assert.equal(created.length, 1);
      assert.equal(updates.length, 0);
      assert.doesNotMatch(JSON.stringify(response), /provider|private|403/);
    } finally { mailer.sendWaitlistConfirmationEmail = send; }
  });
  await t.test("honeypot does not save a signup or send email", async () => {
    const { service, created } = fixture();
    await service.post({ body: payload({ website: "spam.invalid" }) });
    assert.equal(created.length + sent.length, 0);
  });
  await t.test("concurrent duplicate signup returns a friendly response", async () => {
    const { service, store } = fixture();
    store.create = async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); };
    const response = await service.post({ body: payload() });
    assert.equal(response.status, 202);
    assert.doesNotMatch(response.data.message, /code|verif/i);
    assert.equal(sent.length, 0);
  });
  await t.test("server rejects invalid team sizes, missing consent and missing business names", () => {
    for (const extra of [{ teamSize: "100000" }, { consent: false }, { businessName: "" }]) {
      assert.throws(() => payload(extra));
    }
  });
  await t.test("custom cities are trimmed and passed as Prisma data, not SQL", async () => {
    for (const city of ["  Abeokuta  ", "N'Djamena", "São Paulo", "Ìbàdàn", "Port-Harcourt"]) {
      const { service, created } = fixture();
      await service.post({ body: payload({ city }) });
      assert.equal(created[0].city, city.trim());
    }
  });
  await t.test("city validation rejects placeholder, oversized, control and injection-like input", () => {
    for (const city of ["Other", "a".repeat(101), "Lagos\u0000", "Lagos\nAbuja", "<script>alert(1)</script>", "Lagos'; DROP TABLE waitlist_entries;--"]) {
      assert.throws(() => payload({ city }));
    }
  });
  await t.test("admin can invite waiting entries without claiming email verification", async () => {
    const { service, store } = fixture();
    let where: any;
    store.findMany = async (query: any) => { where = query.where; return []; };
    await service.postAdminInvite({ body: { ids: ["fixture-id"] } });
    assert.equal(where.verifiedAt, undefined);
    assert.deepEqual(where.status.in, ["waiting", "invited"]);
  });
});
