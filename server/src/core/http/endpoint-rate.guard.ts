import { CanActivate, ExecutionContext, HttpException, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service";

interface RatePolicy { name: string; max: number; windowMs: number; byUser: boolean }
const RATE_KEY = "owuja.ratePolicy";
export const RateLimit = (name: string, max: number, windowMs: number, byUser = false) =>
  SetMetadata(RATE_KEY, { name, max, windowMs, byUser } satisfies RatePolicy);

/** Development can use memory; production defaults to atomic shared DB counters. */
@Injectable()
export class EndpointRateGuard implements CanActivate {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  private nextCleanupAt = 0;
  constructor(@Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DatabaseService) private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RatePolicy>(RATE_KEY, [context.getHandler(), context.getClass()]);
    if (!policy) return true;
    const now = Date.now();
    if (now >= this.nextCleanupAt) {
      for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
      this.nextCleanupAt = now + 60_000;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const identity = policy.byUser && request.authUserId ? request.authUserId : request.ip ?? "unknown";
    const key = createHash("sha256").update(`${policy.name}:${identity}`).digest("hex");
    const shared = (process.env.RATE_LIMIT_STORE ?? (process.env.NODE_ENV === "production" ? "database" : "memory")) === "database";
    let bucket: { count: number; resetAt: number };
    if (shared) {
      const rows = await this.database.identityClient.$queryRaw<Array<{ hits: number; resetAt: Date }>>`
        INSERT INTO "rate_limit_buckets" ("key", "hits", "resetAt")
        VALUES (${key}, 1, clock_timestamp() + (${policy.windowMs} * INTERVAL '1 millisecond'))
        ON CONFLICT ("key") DO UPDATE SET
          "hits" = CASE WHEN "rate_limit_buckets"."resetAt" <= clock_timestamp() THEN 1 ELSE "rate_limit_buckets"."hits" + 1 END,
          "resetAt" = CASE WHEN "rate_limit_buckets"."resetAt" <= clock_timestamp()
            THEN clock_timestamp() + (${policy.windowMs} * INTERVAL '1 millisecond') ELSE "rate_limit_buckets"."resetAt" END
        RETURNING "hits", "resetAt"
      `;
      if (!rows[0]) throw new HttpException({ error: "We couldn't check this request. Please try again shortly." }, 503);
      bucket = { count: rows[0].hits, resetAt: rows[0].resetAt.getTime() };
    } else {
      bucket = this.buckets.get(key) ?? { count: 0, resetAt: now + policy.windowMs };
      if (bucket.resetAt <= now) bucket = { count: 0, resetAt: now + policy.windowMs };
      bucket.count++;
      this.buckets.set(key, bucket);
    }
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    response.setHeader("RateLimit-Limit", policy.max);
    response.setHeader("RateLimit-Remaining", Math.max(0, policy.max - bucket.count));
    response.setHeader("RateLimit-Reset", resetSeconds);
    if (bucket.count > policy.max) {
      response.setHeader("Retry-After", resetSeconds);
      throw new HttpException({ error: policy.name === "chat" ? "Too many messages. Please wait a moment before continuing." : "Too many requests. Please try again later." }, 429);
    }
    return true;
  }
}
