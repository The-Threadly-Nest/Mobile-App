import { AsyncLocalStorage } from "node:async_hooks";
import type { AccountIdentity } from "../auth/account-identity";

interface DatabaseContext { actor?: AccountIdentity }
const context = new AsyncLocalStorage<DatabaseContext>();
export function runDatabaseRequest<T>(work: () => T): T { return context.run({}, work); }
export function setDatabaseActor(actor: AccountIdentity): void {
  const current = context.getStore();
  if (current) current.actor = {
    authUserId: actor.authUserId,
    authRole: actor.authRole,
    authFashionHouseId: actor.authFashionHouseId,
    authEmailVerified: actor.authEmailVerified,
  };
}
export function databaseActor(): AccountIdentity | undefined { return context.getStore()?.actor; }
