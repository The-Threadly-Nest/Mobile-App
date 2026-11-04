import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createScopedClient } from "../core/database/scoped-client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
  var prismaPoolGlobal: Pool | undefined;
  var identityPrismaGlobal: PrismaClient | undefined;
  var identityPoolGlobal: Pool | undefined;
}

export const databasePool = global.prismaPoolGlobal ?? new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
const adapter = new PrismaPg(databasePool);

const transactionOptions = { maxWait: 10_000, timeout: 15_000 };
export const runtimePrisma = global.prismaGlobal ?? new PrismaClient({ adapter, transactionOptions });
export const prisma = createScopedClient(runtimePrisma);
const separateIdentity = Boolean(process.env.IDENTITY_DATABASE_URL && process.env.IDENTITY_DATABASE_URL !== process.env.DATABASE_URL);
export const identityPool = separateIdentity
  ? global.identityPoolGlobal ?? new Pool({ connectionString: process.env.IDENTITY_DATABASE_URL, connectionTimeoutMillis: 10_000 }) : databasePool;
export const identityPrisma = separateIdentity
  ? global.identityPrismaGlobal ?? new PrismaClient({ adapter: new PrismaPg(identityPool), transactionOptions }) : runtimePrisma;

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = runtimePrisma;
  global.prismaPoolGlobal = databasePool;
  global.identityPrismaGlobal = identityPrisma;
  global.identityPoolGlobal = identityPool;
}
