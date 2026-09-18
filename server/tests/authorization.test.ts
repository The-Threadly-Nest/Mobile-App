import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import {
  bookingAccessWhere,
  moodboardAccessWhere,
  orderAccessWhere,
} from "../src/lib/authorization";

function actor(
  role: "admin" | "staff" | "customer",
  userId: string,
  fashionHouseId?: string
): Request {
  return {
    authRole: role,
    authUserId: userId,
    authFashionHouseId: fashionHouseId ?? null,
  } as Request;
}

test("admin and staff order access is restricted to their fashion house", () => {
  const admin = actor("admin", "admin-a", "house-a");
  const staff = actor("staff", "staff-a", "house-a");

  assert.deepEqual(orderAccessWhere(admin), { fashionHouseId: "house-a" });
  assert.deepEqual(orderAccessWhere(staff), { fashionHouseId: "house-a" });
  assert.deepEqual(bookingAccessWhere(admin), { fashionHouseId: "house-a" });
});

test("customer order and booking access is restricted to their identity", () => {
  const customer = actor("customer", "customer-a");

  assert.deepEqual(orderAccessWhere(customer), {
    customer: { userId: "customer-a" },
  });
  assert.deepEqual(bookingAccessWhere(customer), {
    customerId: "customer-a",
  });
});

test("customer cannot obtain a fashion-house moodboard predicate", () => {
  assert.throws(
    () => moodboardAccessWhere(actor("customer", "customer-a")),
    /Fashion house access required/
  );
});

test("moodboard promotion is restricted to creators in the administrator's house", () => {
  assert.deepEqual(
    moodboardAccessWhere(actor("admin", "admin-a", "house-a")),
    {
      staff: {
        OR: [
          { role: "staff", fashionHouseId: "house-a" },
          { role: "admin", fashionHouseOwned: { id: "house-a" } },
        ],
      },
    }
  );
});
