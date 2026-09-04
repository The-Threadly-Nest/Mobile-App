import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { inviteStaffSchema } from "../schemas/staff.schema";
import { hashPassword, generateResetToken, hashResetToken } from "../lib/password";
import { sendWelcomeEmail, sendStaffActivationEmail, sendStaffInviteEmail } from "../lib/mailer";

const router = Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.authUserId! },
      include: {
        fashionHouse: {
          include: {
            admin: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "User not found." });

    const rawAdminName = user.fashionHouse?.admin?.name || (user.fashionHouse?.admin?.email ? user.fashionHouse.admin.email.split("@")[0] : null);
    const adminName = rawAdminName ? rawAdminName.charAt(0).toUpperCase() + rawAdminName.slice(1) : "Fashion House Admin";

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      fashionHouseId: user.fashionHouseId,
      shopName: user.fashionHouse?.shopName || "Luxury Atelier",
      adminName,
    });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole("admin"));

async function getOwnFashionHouse(adminUserId: string) {
  const fh = await prisma.fashionHouse.findUnique({ where: { adminId: adminUserId } });
  if (!fh) throw Object.assign(new Error("Fashion house not found for this admin"), { status: 404 });
  return fh;
}

router.post("/invite", validate({ body: inviteStaffSchema }), async (req, res, next) => {
  try {
    const fh = await getOwnFashionHouse(req.authUserId!);
    const { name, email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === "admin") {
        return res.status(400).json({
          error: "This email is registered to a Fashion House Admin and cannot be added as a staff member.",
        });
      }
      if (existing.role === "customer") {
        return res.status(400).json({
          error: "This email is registered to a Customer account and cannot be added as a staff member.",
        });
      }
      return res.status(400).json({
        error: "An account with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(password);

    const staffUser = await prisma.user.create({
      data: {
        name: name ? name.trim() : null,
        email,
        passwordHash,
        role: "staff",
        fashionHouseId: fh.id,
        active: true,
      },
    });

    await sendStaffInviteEmail({
      to: email,
      name: name.trim(),
      fashionHouseName: fh.shopName,
      tempPassword: password,
    }).catch(() => {});

    res.status(201).json({ id: staffUser.id, name: staffUser.name, email: staffUser.email, active: staffUser.active, message: "Staff account created successfully." });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const fh = await getOwnFashionHouse(req.authUserId!);

    const staff = await prisma.user.findMany({
      where: { fashionHouseId: fh.id, role: "staff" },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
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
    const sessions = await prisma.chatSession.findMany({
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
        for (let i = history.length - 1; i >= 0; i--) {
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
        lastMessage: lastTurn ? lastTurn.text : null,
        unreadCount,
      };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});


router.post("/:staffId/resend-activation", async (req, res, next) => {
  try {
    const fh = await getOwnFashionHouse(req.authUserId!);
    const staffUser = await prisma.user.findFirst({ where: { id: req.params.staffId, fashionHouseId: fh.id, role: "staff", active: false } });
    if (!staffUser) return res.status(404).json({ error: "Pending staff invitation not found." });

    const rawToken = generateResetToken();
    const resetTokenHash = hashResetToken(rawToken);
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: staffUser.id }, data: { resetTokenHash, resetTokenExpiresAt } });

    await sendStaffActivationEmail(staffUser.email, staffUser.email, fh.shopName, rawToken);
    res.json({ message: "Activation link resent." });
  } catch (err) {
    next(err);
  }
});

export default router;
