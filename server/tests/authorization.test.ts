import assert from "node:assert/strict";
import test from "node:test";
import type { AccountIdentity } from "../src/core/auth/account-identity";
import {
  availableSlotClaimWhere,
  bookingAccessWhere,
  moodboardAccessWhere,
  orderAccessWhere,
} from "../src/lib/authorization";

function actor(
  role: "admin" | "staff" | "customer",
  userId: string,
  fashionHouseId?: string
): AccountIdentity {
  return {
    authRole: role,
    authUserId: userId,
    authFashionHouseId: fashionHouseId ?? null,
  };
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

test("slot claims are restricted to the selected fashion house and unbooked rows", () => {
  const before = Date.now();
  const claim = availableSlotClaimWhere("slot-a", "house-a");
  assert.deepEqual({ ...claim, startsAt: undefined }, {
    id: "slot-a",
    fashionHouseId: "house-a",
    booked: false,
    active: true,
    startsAt: undefined,
  });
  assert.ok(claim.startsAt.gt.getTime() >= before);
  assert.ok(claim.startsAt.gt.getTime() <= Date.now());
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
