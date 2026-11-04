export type AccountRole = "admin" | "staff" | "customer";

export interface AccountIdentity {
  authUserId?: string;
  authEmail?: string;
  authRole?: AccountRole;
  authFashionHouseId?: string | null;
  authEmailVerified?: boolean;
}

export function getOwnFashionHouseId(identity: AccountIdentity): string {
  if (identity.authRole !== "admin" && identity.authRole !== "staff") {
    throw Object.assign(new Error("Fashion house access required."), { status: 403 });
  }
  if (!identity.authFashionHouseId) {
    throw Object.assign(new Error("Fashion house not found. Please log out and log in again to refresh your session."), { status: 404 });
  }
  return identity.authFashionHouseId;
}

declare global {
  namespace Express {
    interface Request extends AccountIdentity {}
  }
}
