import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { databaseActor } from "./database-context";

const delegates = new Set(Object.keys(Prisma.ModelName).map((name) => name.charAt(0).toLowerCase() + name.slice(1)));

/** Every scoped operation gets transaction-local settings on its own connection.
 * Never SET session-wide identity on a pooled connection: that leaks identities.
 */
export function createScopedClient(client: PrismaClient): PrismaClient {
  const scoped = <T>(work: (transaction: Prisma.TransactionClient) => Promise<T> | T, options?: object): Promise<T> => {
    const actor = databaseActor();
    if (!actor?.authUserId || !actor.authRole) return Promise.reject(new Error("A verified request identity is required for database access."));
    return client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT
        set_config('owuja.user_id', ${actor.authUserId!}, true),
        set_config('owuja.role', ${actor.authRole!}, true),
        set_config('owuja.house_id', ${actor.authFashionHouseId ?? ""}, true)`;
      return work(transaction);
    }, options);
  };
  return new Proxy(client, {
    get(target, property) {
      const original = Reflect.get(target, property);
      if (process.env.DATABASE_RLS_ENABLED !== "true") return typeof original === "function" ? original.bind(target) : original;
      if (property === "$transaction") return (work: unknown, options?: object) => {
        if (typeof work !== "function") throw new Error("Scoped database transactions require the callback form.");
        return scoped((transaction) => work(transaction), options);
      };
      if (property === "$queryRaw" || property === "$executeRaw") return (...args: unknown[]) => scoped((transaction) =>
        Reflect.apply(Reflect.get(transaction, property), transaction, args));
      if (property === "$queryRawUnsafe" || property === "$executeRawUnsafe" || property === "$extends") {
        return () => { throw new Error("This operation is not available on the scoped database client."); };
      }
      if (typeof property === "string" && delegates.has(property)) return new Proxy(original, {
        get(_delegate, method) {
          return (...args: unknown[]) => scoped((transaction) => {
            const delegate = Reflect.get(transaction, property);
            return Reflect.apply(Reflect.get(delegate, method), delegate, args);
          });
        },
      });
      return typeof original === "function" ? original.bind(target) : original;
    },
  });
}
