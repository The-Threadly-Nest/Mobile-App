import { randomUUID } from "crypto";
import type { Prisma } from "../generated/prisma/client";
export async function saveDecline(tx: Prisma.TransactionClient, house: string, target: string, actor: string, comment: string) {
  await tx.$executeRaw`INSERT INTO decline_records (id, "fashionHouseId", "targetId", "actorId", comment) VALUES (${randomUUID()}, ${house}, ${target}, ${actor}, ${comment})`;
}
