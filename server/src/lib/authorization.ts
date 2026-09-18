import type { Request } from "express";
import type { Prisma } from "../generated/prisma/client";

function houseIdentity(req: Request): string {
  if ((req.authRole !== "admin" && req.authRole !== "staff") || !req.authFashionHouseId) {
    throw Object.assign(new Error("Fashion house access required."), { status: 403 });
  }
  return req.authFashionHouseId;
}

function customerIdentity(req: Request): string {
  if (req.authRole !== "customer" || !req.authUserId) {
    throw Object.assign(new Error("Access denied."), { status: 403 });
  }
  return req.authUserId;
}

export function orderAccessWhere(req: Request): Prisma.OrderWhereInput {
  return req.authRole === "customer"
    ? { customer: { userId: customerIdentity(req) } }
    : { fashionHouseId: houseIdentity(req) };
}

export function bookingAccessWhere(req: Request): Prisma.BookingWhereInput {
  return req.authRole === "customer"
    ? { customerId: customerIdentity(req) }
    : { fashionHouseId: houseIdentity(req) };
}

export function moodboardAccessWhere(req: Request): Prisma.MoodBoardSketchWhereInput {
  const houseId = houseIdentity(req);
  return { staff: { OR: [
    { role: "staff", fashionHouseId: houseId },
    { role: "admin", fashionHouseOwned: { id: houseId } },
  ] } };
}
