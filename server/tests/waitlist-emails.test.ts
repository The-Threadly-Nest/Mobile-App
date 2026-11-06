import assert from "node:assert/strict";
import test from "node:test";

test("waitlist welcome emails use audience-specific copy and safe links", async (t) => {
  const { sendWaitlistConfirmationEmail } = require("../dist/src/lib/mailer");
  const originalFetch = global.fetch;
  const names = ["RESEND_API_KEY", "WAITLIST_PUBLIC_URL"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.RESEND_API_KEY = "email-test-only-not-a-real-key";
  process.env.WAITLIST_PUBLIC_URL = "https://example.invalid/";
  const sent: any[] = [];
  const headers: any[] = [];
  global.fetch = async (_url: any, options: any) => {
    sent.push(JSON.parse(options.body));
    headers.push(options.headers);
    return new Response("{}", { status: 200 });
  };
  t.after(() => {
    global.fetch = originalFetch;
    for (const name of names) if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
  });
  const send = (audience: string, name = "Chiamaka Okafor") => sendWaitlistConfirmationEmail({
    to: "person@example.invalid", name, audience, referralCode: "AB12CD34EF", unsubscribeToken: "test-token&value", idempotencyKey: "waitlist-welcome/fixture-id",
  });
  await t.test("customers receive the discovery and custom-fashion welcome", async () => {
    await send("customer");
    const email = sent.at(-1);
    assert.equal(email.subject, "You're on the Owuja waitlist");
    assert.match(email.text, /^Hi Chiamaka,/);
    assert.match(email.text, /discover designers/);
    assert.match(email.text, /Where thread meets the market/);
    assert.doesNotMatch(email.text, /organise your team/);
    assert.equal(headers.at(-1)["Idempotency-Key"], "waitlist-welcome/fixture-id");
    assert.equal(email.idempotencyKey, undefined);
  });
  await t.test("designers receive the fashion-business welcome", async () => {
    await send("fashion_house");
    const email = sent.at(-1);
    assert.equal(email.subject, "Your next chapter in fashion starts with Owuja");
    for (const text of ["manage orders", "save measurements", "organise your team", "send invoices"]) assert.ok(email.text.includes(text));
    assert.match(email.html, /Your fashion business, all in one place/);
  });
  await t.test("both formats retain referral and unsubscribe links without promising immediate access", () => {
    for (const email of sent) {
      for (const format of [email.text, email.html]) {
        assert.ok(format.includes("https://example.invalid/?ref=AB12CD34EF"));
        assert.ok(format.includes("https://example.invalid/unsubscribe?token=test-token%26value"));
        assert.match(format, /when early access opens/);
      }
    }
  });
  await t.test("both welcome emails use the actual logo without a boxed template", () => {
    for (const email of sent) {
      assert.match(email.html, /<img src="https:\/\/example\.invalid\/assets\/email-logo\.png" alt="Owuja"/);
      const wrapper = email.html.match(/<div style="([^"]+)"/)?.[1];
      assert.ok(wrapper);
      assert.doesNotMatch(wrapper, /border:|border-radius:/);
      assert.doesNotMatch(email.html, /<h1/);
    }
  });
  await t.test("body uses black Instrument Sans text and only a rounded Unsubscribe button", () => {
    for (const email of sent) {
      assert.match(email.html, /font-family:'Instrument Sans',Arial,sans-serif/);
      assert.match(email.html, /https:\/\/example\.invalid\/assets\/fonts\/InstrumentSans-Regular\.ttf/);
      assert.match(email.html, /color:#000000/);
      assert.doesNotMatch(email.html, /color:#(?:453332|746765)|Leave the waitlist/);
      assert.doesNotMatch(email.text, /Leave the waitlist/);
      assert.match(email.html, /<a href="https:\/\/example\.invalid\/unsubscribe\?[^\"]+" style="[^\"]*border-radius:999px[^\"]*">Unsubscribe<\/a>/);
      assert.match(email.text, /Unsubscribe: https:/);
    }
  });
  await t.test("HTML escapes names and blank names have a friendly fallback", async () => {
    await send("customer", '<img/src=x/onerror=alert(1)> Person');
    assert.doesNotMatch(sent.at(-1).html, /<img\/src=x/);
    assert.equal((sent.at(-1).html.match(/<img\b/g) || []).length, 1);
    assert.match(sent.at(-1).html, /&lt;img/);
    await send("customer", "   ");
    assert.match(sent.at(-1).text, /^Hi there,/);
  });
});
