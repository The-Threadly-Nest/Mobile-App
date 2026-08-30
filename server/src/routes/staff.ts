import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { inviteStaffSchema } from "../schemas/staff.schema";
import { hashPassword } from "../lib/password";
import { sendWelcomeEmail } from "../lib/mailer";

const router = Router();
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
    if (existing) return res.status(400).json({ error: "An account with this email already exists." });

    const passwordHash = await hashPassword(password);

    const staffUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "staff",
        fashionHouseId: fh.id,
        active: true,
      },
    });

    await sendWelcomeEmail(email, name).catch(() => {});
    res.status(201).json({ id: staffUser.id, email: staffUser.email, active: staffUser.active, message: "Staff account created successfully." });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const fh = await getOwnFashionHouse(req.authUserId!);
    const staff = await prisma.user.findMany({
      where: { fashionHouseId: fh.id, role: "staff" },
      select: { id: true, email: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(staff);
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
