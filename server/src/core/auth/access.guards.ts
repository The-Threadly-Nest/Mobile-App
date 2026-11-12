import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, InternalServerErrorException, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import jwt from "jsonwebtoken";
import { DatabaseService } from "../database/database.service";
import { credentialVersion } from "../../lib/session";
import type { AccountRole } from "./account-identity";
import { setDatabaseActor } from "../database/database-context";

const ROLES_KEY = "owuja.allowedRoles";
export const AllowedRoles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException({ error: "Please log in to continue." });
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new InternalServerErrorException({ error: "Server misconfiguration" });
    let decoded: jwt.JwtPayload;
    try {
      const payload = jwt.verify(header.slice(7), secret, { algorithms: ["HS256"] });
      if (typeof payload === "string") throw new UnauthorizedException({ error: "Please log in again." });
      decoded = payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) throw new UnauthorizedException({ error: "Your session has expired. Please log in again." });
      throw error;
    }
    if (typeof decoded.sub !== "string" || typeof decoded.credentialVersion !== "string") {
      throw new UnauthorizedException({ error: "Please log in again." });
    }
    const user = await this.database.identityClient.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, active: true, passwordHash: true, emailVerifiedAt: true,
        fashionHouseId: true, resetTokenPurpose: true, resetTokenExpiresAt: true, fashionHouseOwned: { select: { id: true } } },
    });
    const staffSetup = Boolean(user && decoded.staffSetup === true && user.role === "staff" && !user.active && user.resetTokenPurpose === "staff_temporary_password" && user.resetTokenExpiresAt && user.resetTokenExpiresAt > new Date());
    if (!user || (!user.active && !staffSetup) || !["admin", "staff", "customer"].includes(user.role) ||
        decoded.role !== user.role || decoded.credentialVersion !== credentialVersion(user.id, user.passwordHash, secret)) {
      throw new UnauthorizedException({ error: "Please log in again." });
    }
    if (decoded.staffSetup === true && !staffSetup) throw new UnauthorizedException({ error: "Please log in again." });
    const setupRoute = (request.method === "POST" && request.path === "/api/auth/change-password") || (request.method === "GET" && request.path === "/api/auth/session");
    if (staffSetup && !setupRoute) throw new ForbiddenException({ error: "Set your new password before continuing.", code: "STAFF_PASSWORD_CHANGE_REQUIRED" });
    if (user.role === "admin" && !user.emailVerifiedAt) {
      throw new ForbiddenException({ error: "Verify your email before continuing.", code: "EMAIL_NOT_VERIFIED" });
    }
    request.authUserId = user.id;
    request.authEmail = user.email;
    request.authEmailVerified = Boolean(user.emailVerifiedAt);
    request.authRole = user.role as AccountRole;
    request.authFashionHouseId = user.role === "admin"
      ? user.fashionHouseOwned?.id ?? null : user.role === "staff" ? user.fashionHouseId : null;
    setDatabaseActor(request);
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccountRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.authRole || !roles?.includes(request.authRole)) {
      throw new ForbiddenException({ error: "You don't have permission to do that." });
    }
    return true;
  }
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const emails = (process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (request.authRole !== "admin" || !request.authEmailVerified || !request.authEmail || !emails.includes(request.authEmail.toLowerCase())) {
      throw new ForbiddenException({ error: "Platform administrator access is required." });
    }
    return true;
  }
}
