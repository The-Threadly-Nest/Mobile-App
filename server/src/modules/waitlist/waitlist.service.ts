import { Inject, Injectable } from "@nestjs/common";
import { logFailure } from "../../core/logging";
import { routeParam } from "../../core/http/route-param";
import type { WaitlistInput } from "./waitlist.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";

import { sendWaitlistConfirmationEmail, sendWaitlistInviteEmail } from "../../lib/mailer";

@Injectable()
export class WaitlistService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async getStats() {
    // Aggregate only: never expose emails, names or referral codes publicly.
    const registered = await this.database.identityClient.waitlistEntry.count();
    const capacity = 5000;
    return { registered, capacity, remaining: Math.max(0, capacity - registered) };
  }

  async post(input: WaitlistInput<"post">) {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw Object.assign(new Error("Server misconfiguration."), { status: 500 });
      const publicMessage = "Thanks for your interest in Owuja. We'll be in touch when early access opens.";
      if (input.body.website) {
        return result({ message: publicMessage }, 202);
      }

      const existing = await this.database.identityClient.waitlistEntry.findUnique({ where: { email: input.body.email } });
      if (existing) {
        // Do not disclose an existing person's referral code, overwrite their
        // details, or resubscribe someone who has opted out.
        return result({ message: publicMessage }, 202);
      }

      const referralCode = await this.createReferralCode();
      const entry = await this.database.identityClient.waitlistEntry.create({
        data: {
          email: input.body.email,
          name: input.body.name,
          audience: input.body.audience,
          businessName: input.body.audience === "fashion_house" ? input.body.businessName : null,
          teamSize: input.body.audience === "fashion_house" ? input.body.teamSize : null,
          phone: input.body.phone,
          city: input.body.city,
          instagram: input.body.audience === "fashion_house" ? input.body.instagram : null,
          interests: input.body.audience === "customer" ? input.body.interests : null,
          source: input.body.source,
          referralCode,
          referredBy: input.body.referredBy,
          consentedAt: new Date(),
        },
      });

      const unsubscribeToken = jwt.sign(
        { email: entry.email, purpose: "waitlist_unsubscribe" },
        secret,
        { algorithm: "HS256", expiresIn: "365d" },
      );
      try {
        await sendWaitlistConfirmationEmail({
          to: entry.email, name: entry.name,
          audience: entry.audience as "customer" | "fashion_house",
          referralCode: entry.referralCode, unsubscribeToken,
        });
        await this.database.identityClient.waitlistEntry.update({
          where: { id: entry.id }, data: { confirmationSentAt: new Date() },
        });
      } catch (error) {
        logFailure("You're on the waitlist, but we couldn't send the welcome email.", error);
      }
      return result({ message: publicMessage, referralCode: entry.referralCode }, 202);
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        return result({ message: "Thanks for your interest in Owuja. We'll be in touch when early access opens." }, 202);
      }
      throw error;
    }
  }

  async postUnsubscribe(input: WaitlistInput<"postUnsubscribe">) {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) throw Object.assign(new Error("Server misconfiguration."), { status: 500 });
      const payload = jwt.verify(input.body.token, secret, { algorithms: ["HS256"] }) as { email?: string; purpose?: string };
      if (payload.purpose !== "waitlist_unsubscribe" || !payload.email) {
        return rejectRequest({ error: "This unsubscribe link is invalid or has expired." }, 400);
      }
      await this.database.identityClient.waitlistEntry.updateMany({
        where: { email: payload.email.toLowerCase() },
        data: { status: "unsubscribed" },
      });
      return { message: "You have been removed from Owuja waitlist updates." };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return rejectRequest({ error: "This unsubscribe link is invalid or has expired." }, 400);
      }
      throw error;
    }
  }

  async getAdmin(input: WaitlistInput<"getAdmin">) {

    const { audience, status, search, page, limit } = input.query as unknown as {
      audience: "all" | "customer" | "fashion_house";
      status: "all" | "waiting" | "invited" | "joined" | "unsubscribed";
      search: string;
      page: number;
      limit: number;
    };
    const where = {
      ...(audience !== "all" ? { audience } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(search ? {
        OR: ["name", "email", "businessName", "city"].map((field) => ({
          [field]: { contains: search, mode: "insensitive" as const },
        })),
      } : {}),
    };

    const [entries, total, groupedAudience, groupedStatus] = await Promise.all([
      this.database.identityClient.waitlistEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.database.identityClient.waitlistEntry.count({ where }),
      this.database.identityClient.waitlistEntry.groupBy({ by: ["audience"], _count: { _all: true } }),
      this.database.identityClient.waitlistEntry.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const audienceCounts = Object.fromEntries(groupedAudience.map((row) => [row.audience, row._count._all]));
    const statusCounts = Object.fromEntries(groupedStatus.map((row) => [row.status, row._count._all]));
    return {
      entries,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: {
        total: Object.values(audienceCounts).reduce((sum, count) => sum + Number(count), 0),
        customers: audienceCounts.customer || 0,
        fashionHouses: audienceCounts.fashion_house || 0,
        waiting: statusCounts.waiting || 0,
        invited: statusCounts.invited || 0,
        joined: statusCounts.joined || 0,
      },
    };

  }

  async patchAdminByIdStatus(input: WaitlistInput<"patchAdminByIdStatus">) {

    const updated = await this.database.identityClient.waitlistEntry.update({
      where: { id: routeParam(input, "id") },
      data: {
        status: input.body.status,
        ...(input.body.status === "joined" ? { joinedAt: new Date() } : {}),
      },
    });
    return updated;

  }

  async postAdminInvite(input: WaitlistInput<"postAdminInvite">) {

    const entries = await this.database.identityClient.waitlistEntry.findMany({
      where: { id: { in: input.body.ids }, status: { in: ["waiting", "invited"] } },
    });

    const delivered: string[] = [];
    const failed: string[] = [];
    for (const entry of entries) {
      try {
        await sendWaitlistInviteEmail({ to: entry.email, name: entry.name });
        await this.database.identityClient.waitlistEntry.update({
          where: { id: entry.id },
          data: { status: "invited", invitedAt: new Date() },
        });
        delivered.push(entry.id);
      } catch {
        failed.push(entry.id);
      }
    }

    return { delivered, failed };

  }

  private async createReferralCode(): Promise<string> {
    for (let attempt = 0;attempt < 5;attempt += 1) {
      const code = randomBytes(5).toString("hex").toUpperCase();
      const existing = await this.database.identityClient.waitlistEntry.findUnique({ where: { referralCode: code }, select: { id: true } });
      if (!existing) return code;
    }
    throw Object.assign(new Error("Could not create a referral code."), { status: 503 });
  }
}

