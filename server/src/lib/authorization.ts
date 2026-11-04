import type { AccountIdentity } from "../core/auth/account-identity";
import type { Prisma } from "../generated/prisma/client";

function houseIdentity(req: AccountIdentity): string {
  if ((req.authRole !== "admin" && req.authRole !== "staff") || !req.authFashionHouseId) {
    throw Object.assign(new Error("Fashion house access required."), { status: 403 });
  }
  return req.authFashionHouseId;
}

function customerIdentity(req: AccountIdentity): string {
  if (req.authRole !== "customer" || !req.authUserId) {
    throw Object.assign(new Error("Access denied."), { status: 403 });
  }
  return req.authUserId;
}

export function orderAccessWhere(req: AccountIdentity): Prisma.OrderWhereInput {
  return req.authRole === "customer"
    ? { customer: { userId: customerIdentity(req) } }
    : { fashionHouseId: houseIdentity(req) };
}

export function bookingAccessWhere(req: AccountIdentity): Prisma.BookingWhereInput {
  return req.authRole === "customer"
    ? { customerId: customerIdentity(req) }
    : { fashionHouseId: houseIdentity(req) };
}

export function availableSlotClaimWhere(slotId: string, fashionHouseId: string) {
  return {
    id: slotId,
    fashionHouseId,
    booked: false,
    active: true,
    startsAt: { gt: new Date() },
  } as const;
}

export function moodboardAccessWhere(req: AccountIdentity): Prisma.MoodBoardSketchWhereInput {
  const houseId = houseIdentity(req);
  return { staff: { OR: [
    { role: "staff", fashionHouseId: houseId },
    { role: "admin", fashionHouseOwned: { id: houseId } },
  ] } };
}
