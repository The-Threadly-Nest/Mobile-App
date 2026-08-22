import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { escalationIdParamSchema, resolveEscalationSchema } from "../schemas/escalation.schema";

const router = Router();
router.use(requireAuth);

async function getAdminFashionHouseOrThrow(userId: string) {
  const admin = await prisma.user.findUnique({ where: { id: userId }, include: { fashionHouseOwned: true } });
  if (!admin || admin.role !== "admin" || !admin.fashionHouseOwned) {
    throw Object.assign(new Error("Admin access required"), { status: 403 });
  }
  return admin.fashionHouseOwned;
}

router.get("/", async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const escalations = await prisma.chatEscalation.findMany({
      where: { fashionHouseId: fh.id },
      orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
      include: { customer: { select: { id: true, email: true } } },
    });
    res.json(escalations);
  } catch (err) {
    next(err);
  }
});

router.get("/:escalationId", validate({ params: escalationIdParamSchema }), async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const escalation = await prisma.chatEscalation.findFirst({
      where: { id: req.params.escalationId, fashionHouseId: fh.id },
      include: { customer: { select: { id: true, email: true } } },
    });
    if (!escalation) return res.status(404).json({ error: "Escalation not found" });

    let transcript: unknown[] = [];
    try { transcript = JSON.parse(escalation.transcript); } catch {}
    res.json({ ...escalation, transcript });
  } catch (err) {
    next(err);
  }
});

router.patch("/:escalationId/resolve", validate({ params: escalationIdParamSchema, body: resolveEscalationSchema }), async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const escalation = await prisma.chatEscalation.findFirst({ where: { id: req.params.escalationId, fashionHouseId: fh.id } });
    if (!escalation) return res.status(404).json({ error: "Escalation not found" });

    if (req.body.assignToStaffId) {
      const staff = await prisma.user.findFirst({ where: { id: req.body.assignToStaffId, fashionHouseId: fh.id, role: "staff" } });
      if (!staff) return res.status(404).json({ error: "Staff member not found in this fashion house" });
    }

    const updated = await prisma.chatEscalation.update({ where: { id: escalation.id }, data: { resolved: true } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
