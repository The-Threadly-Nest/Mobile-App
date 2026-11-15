import { Inject, Injectable } from "@nestjs/common";
import { logFailure } from "../../core/logging";
import { routeParam } from "../../core/http/route-param";
import type { StaffInput } from "./staff.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { hashPassword } from "../../lib/password";
import { randomBytes } from "crypto";
import { sendStaffInviteEmail } from "../../lib/mailer";

@Injectable()
export class StaffService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async getMe(input: StaffInput<"getMe">) {

    const user = await this.database.client.user.findUnique({
      where: { id: input.authUserId! },
      include: {
        fashionHouse: {
          include: {
            admin: { select: { id: true, name: true, email: true, updatedAt: true } },
          },
        },
      },
    });
    if (!user) return rejectRequest({ error: "User not found." }, 404);

    const rawAdminName = user.fashionHouse?.admin?.name || (user.fashionHouse?.admin?.email ? user.fashionHouse.admin.email.split("@")[0] : null);
    const adminName = rawAdminName ? rawAdminName.charAt(0).toUpperCase() + rawAdminName.slice(1) : "Fashion House Admin";

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      fashionHouseId: user.fashionHouseId,
      shopName: user.fashionHouse?.shopName || "Luxury Atelier",
      adminName,
      adminOnline: Date.now() - (user.fashionHouse?.admin?.updatedAt?.getTime() ?? 0) <= 90_000,
      adminLastSeenAt: user.fashionHouse?.admin?.updatedAt?.toISOString() ?? null,
    };

  }

  async postInvite(input: StaffInput<"postInvite">) {

    const fh = await this.getOwnFashionHouse(input.authUserId!);
    const { name, email, password } = input.body;

    const existing = await this.database.identityClient.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === "admin") {
        return rejectRequest({
          error: "This email is registered to a Fashion House Admin and cannot be added as a staff member.",
        }, 400);
      }
      if (existing.role === "customer") {
        return rejectRequest({
          error: "This email is registered to a Customer account and cannot be added as a staff member.",
        }, 400);
      }
      return rejectRequest({
        error: "An account with this email already exists.",
      }, 400);
    }

    const temporaryPassword = password || `Ow9!${randomBytes(18).toString("base64url")}`;
    const resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Credential writes use the identity connection after checking house ownership.
    // The runtime RLS insert policy intentionally forbids password hashes.
    const staffUser = await this.database.identityClient.user.create({
      data: {
        name: name ? name.trim() : null,
        email,
        passwordHash: await hashPassword(temporaryPassword),
        role: "staff",
        fashionHouseId: fh.id,
        active: false,
        resetTokenHash: null,
        resetTokenExpiresAt,
        resetTokenPurpose: "staff_temporary_password",
        resetTokenSentAt: new Date(),
      },
    });

    let emailSent = true;
    try {
      await sendStaffInviteEmail({ to: email, name: name.trim(), fashionHouseName: fh.shopName, tempPassword: temporaryPassword });
    } catch (err) {
      emailSent = false;
      logFailure("The staff account was created, but its invitation email could not be sent.", err);
    }

    return result({ id: staffUser.id, name: staffUser.name, email: staffUser.email, active: staffUser.active, emailSent, message: emailSent ? "Staff temporary password sent." : "Staff account created, but the email could not be sent. Open Staff and resend the invitation." }, 201);

  }

  async get(input: StaffInput<"get">) {

    const fh = await this.getOwnFashionHouse(input.authUserId!);

    const staff = await this.database.client.user.findMany({
      where: { fashionHouseId: fh.id, role: "staff" },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            delegatedOrders: {
              where: { status: { notIn: ["completed", "delivered"] } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Batch-fetch chat sessions for all staff in one query
    const staffIds = staff.map((s) => s.id);
    const sessions = await this.database.client.chatSession.findMany({
      where: { customerId: { in: staffIds }, fashionHouseId: fh.id },
      select: { customerId: true, history: true },
    });
    const sessionMap = new Map(sessions.map((s) => [s.customerId, s]));

    const formatted = staff.map((st) => {
      let displayName = st.name ? st.name.trim() : "";
      if (!displayName && st.email) {
        const parts = st.email.split("@")[0].split(/[._-]/);
        displayName = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
      }

      const session = sessionMap.get(st.id);
      const history = (session?.history as any[]) || [];
      const lastTurn = history.length > 0 ? history[history.length - 1] : null;
      let unreadCount = 0;
      if (lastTurn && (lastTurn.role === "staff" || lastTurn.role === "user")) {
        for (let i = history.length - 1;i >= 0;i--) {
          if (history[i].role === "staff" || history[i].role === "user") unreadCount++;
          else break;
        }
      }

      return {
        id: st.id,
        name: displayName || "Staff Member",
        email: st.email,
        active: st.active,
        activeOrders: st._count?.delegatedOrders ?? 0,
        createdAt: st.createdAt,
        lastSeenAt: st.updatedAt,
        online: Date.now() - st.updatedAt.getTime() <= 90_000,
        lastMessage: lastTurn ? lastTurn.text : null,
        unreadCount,
      };
    });

    return formatted;

  }

  async postPresence(input: StaffInput<"postPresence">) {
    const now = new Date();
    await this.database.client.user.update({
      where: { id: input.authUserId! },
      data: { updatedAt: now },
    });
    return { online: true, lastSeenAt: now.toISOString() };
  }

  async postByStaffIdResendActivation(input: StaffInput<"postByStaffIdResendActivation">) {

    const fh = await this.getOwnFashionHouse(input.authUserId!);
    const staffUser = await this.database.client.user.findFirst({ where: { id: routeParam(input, "staffId"), fashionHouseId: fh.id, role: "staff", active: false } });
    if (!staffUser) return rejectRequest({ error: "Pending staff invitation not found." }, 404);

    const temporaryPassword = `Ow9!${randomBytes(18).toString("base64url")}`;
    const resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await this.database.identityClient.user.updateMany({ where: { id: staffUser.id, fashionHouseId: fh.id, role: "staff", active: false },
      data: { passwordHash: await hashPassword(temporaryPassword), resetTokenHash: null, resetTokenExpiresAt, resetTokenPurpose: "staff_temporary_password", resetTokenAttempts: 0, resetTokenSentAt: new Date() } });
    if (!updated.count) return rejectRequest({ error: "This staff account has already been activated." }, 409);

    try {
      await sendStaffInviteEmail({ to: staffUser.email, name: staffUser.name || staffUser.email, fashionHouseName: fh.shopName, tempPassword: temporaryPassword });
    } catch (err) {
      logFailure("The staff activation email could not be sent.", err);
      return rejectRequest({ error: "We couldn't send the activation email. Your staff account is saved. Please try resending shortly." }, 503);
    }
    return { message: "A new temporary password has been sent. The previous password no longer works." };

  }

  private async getOwnFashionHouse(adminUserId: string) {
    const fh = await this.database.client.fashionHouse.findUnique({ where: { adminId: adminUserId } });
    if (!fh) throw Object.assign(new Error("We couldn't find your fashion house. Please log in again."), { status: 404 });
    return fh;
  }
}
