import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { updateOrderStatusSchema, createOrderSchema } from "../src/schemas/orders.schema";
import { assignEscalationSchema } from "../src/schemas/endpoint-bodies.schema";
import { promoteSketchSchema } from "../src/schemas/moodboard.schema";
import { signupSchema } from "../src/schemas/auth.schema";
import { createScopedClient } from "../src/core/database/scoped-client";

test("order updates accept only supported statuses, not arbitrary commands or text", () => {
  for (const status of ["order_placed", "pending_admin_review", "in_production", "ready_for_pickup", "cancelled"]) assert.equal(updateOrderStatusSchema.safeParse({ status }).success, true);
  for (const status of ["", "unknown", "'; DROP TABLE orders; --", ["ready"]]) assert.equal(updateOrderStatusSchema.safeParse({ status }).success, false);
});
test("all edited integer-price inputs reject fractions and PostgreSQL integer overflow", () => {
  for (const price of [1.5, 2147483648, Infinity, -1]) {
    assert.equal(createOrderSchema.safeParse({ customerId: "11111111-1111-4111-8111-111111111111", itemName: "Shirt", price }).success, false);
    assert.equal(assignEscalationSchema.safeParse({ price }).success, false);
    assert.equal(promoteSketchSchema.safeParse({ priceFrom: price }).success, false);
  }
});
test("normal names may contain apostrophes; client-supplied privilege fields are stripped", () => {
  const parsed = signupSchema.parse({ email: "name@example.invalid", password: "ExamplePass123", name: "O'Connor", role: "customer", active: true, fashionHouseId: "foreign", isVerified: true });
  assert.equal(parsed.name, "O'Connor");
  for (const key of ["active", "fashionHouseId", "isVerified"]) assert.equal(key in parsed, false);
});
test("application client blocks unsafe SQL whether RLS is enabled or disabled", () => {
  const previous = process.env.DATABASE_RLS_ENABLED;
  try {
    for (const enabled of ["true", "false"]) {
      process.env.DATABASE_RLS_ENABLED = enabled;
      const client = createScopedClient({ $queryRawUnsafe: () => assert.fail("must never execute"), $executeRawUnsafe: () => assert.fail("must never execute") } as any);
      assert.throws(() => client.$queryRawUnsafe("SELECT 1"), /Unsafe SQL/);
      assert.throws(() => client.$executeRawUnsafe("SELECT 1"), /Unsafe SQL/);
    }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_RLS_ENABLED;
    else process.env.DATABASE_RLS_ENABLED = previous;
  }
});
test("application SQL uses tagged parameterized templates, never raw string calls", () => {
  let checked = 0;
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "generated") continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!file.endsWith(".ts")) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      function visit(node: ts.Node) {
        const expression = ts.isCallExpression(node) ? node.expression : ts.isTaggedTemplateExpression(node) ? node.tag : undefined;
        if (expression && ts.isPropertyAccessExpression(expression)) {
          const access = expression;
          if (/^\$(queryRaw|executeRaw)(Unsafe)?$/.test(access.name.text)) {
            checked++;
            assert.equal(ts.isTaggedTemplateExpression(node), true, file + ": SQL must use a tagged template");
            assert.equal(access.name.text.endsWith("Unsafe"), false, file + ": unsafe SQL is forbidden");
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  walk(path.resolve(__dirname, "../src"));
  assert.ok(checked > 0);
});
