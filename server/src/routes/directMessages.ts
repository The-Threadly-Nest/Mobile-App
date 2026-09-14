import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Helper: resolve the fashionHouseId and customerId for a thread
async function resolveThread(authUserId: string, paramFhId: string) {
  const user = await prisma.user.findUnique({ where: { id: authUserId } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 401 });

  if (user.role === "admin") {
    // Admin's own fashion house
    const fh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
    if (!fh) throw Object.assign(new Error("Fashion house not found for admin"), { status: 404 });
    // Admin views a specific customer thread by customerId passed in paramFhId? No —
    // For admin-initiated, paramFhId is the customerId they want to chat with.
    return { fashionHouseId: fh.id, customerId: paramFhId, senderRole: "admin" as const, senderId: user.id };
  }

  // Customer
  return { fashionHouseId: paramFhId, customerId: user.id, senderRole: "customer" as const, senderId: user.id };
}

// GET /api/direct-messages/thread/:fashionHouseId
// Customer: loads their thread with that fashion house
// Admin: paramFhId is treated as the customerId — loads that customer's thread
router.get("/thread/:fashionHouseId", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(req.authUserId!, req.params.fashionHouseId);

    const messages = await prisma.directMessage.findMany({
      where: { fashionHouseId, customerId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    // Mark unread messages sent to this user as read
    await prisma.directMessage.updateMany({
      where: {
        fashionHouseId,
        customerId,
        senderId: { not: req.authUserId! },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    // Attach the AI chat transcript from the latest escalation for this thread
    // so both customer and admin can see the prior AI conversation history
    let transcript: unknown[] = [];
    try {
      const escalation = await prisma.chatEscalation.findFirst({
        where: { fashionHouseId, customerId },
        orderBy: { createdAt: "desc" },
      });
      if (escalation?.transcript) {
        transcript = JSON.parse(escalation.transcript as string);
      }
    } catch {
      // If parsing fails, transcript stays empty — non-fatal
    }

    res.json({ messages, transcript });
  } catch (err) {
    next(err);
  }
});

// POST /api/direct-messages/thread/:fashionHouseId
// Customer sends to fashion house; admin sends to customer
router.post("/thread/:fashionHouseId", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId, senderRole, senderId } = await resolveThread(req.authUserId!, req.params.fashionHouseId);
    const { text, imageUrl } = req.body as { text?: string; imageUrl?: string };

    if (!text?.trim() && !imageUrl) {
      return res.status(400).json({ error: "Message text or image is required." });
    }

    const message = await prisma.directMessage.create({
      data: {
        fashionHouseId,
        customerId,
        senderRole,
        senderId,
        text: text?.trim() ?? "",
        imageUrl: imageUrl ?? null,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
      },
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/direct-messages/thread/:fashionHouseId/read
router.patch("/thread/:fashionHouseId/read", async (req, res, next) => {
  try {
    const { fashionHouseId, customerId } = await resolveThread(req.authUserId!, req.params.fashionHouseId);

    await prisma.directMessage.updateMany({
      where: {
        fashionHouseId,
        customerId,
        senderId: { not: req.authUserId! },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/direct-messages/threads — admin only, lists all customer threads with unread count
router.get("/threads", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUserId! } });
    if (!user || user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }

    const fh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
    if (!fh) return res.status(404).json({ error: "Fashion house not found." });

    // Find all distinct customers who have messages in this fashion house
    const distinctCustomers = await prisma.directMessage.findMany({
      where: { fashionHouseId: fh.id },
      distinct: ["customerId"],
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    // For each customer, get latest message + unread count (messages sent by customer, not read yet)
    const threads = await Promise.all(
      distinctCustomers.map(async (dm: { customerId: string; customer: { id: string; name: string | null; email: string } }) => {
        const [latestMessage, unreadCount] = await Promise.all([
          prisma.directMessage.findFirst({
            where: { fashionHouseId: fh.id, customerId: dm.customerId },
            orderBy: { createdAt: "desc" },
          }),
          prisma.directMessage.count({
            where: {
              fashionHouseId: fh.id,
              customerId: dm.customerId,
              senderRole: "customer",
              readAt: null,
            },
          }),
        ]);
        return {
          customerId: dm.customerId,
          customerName: dm.customer.name || dm.customer.email || "Customer",
          latestMessage: latestMessage?.text ?? "",
          latestAt: latestMessage?.createdAt ?? null,
          unreadCount,
        };
      })
    );

    res.json(threads);
  } catch (err) {
    next(err);
  }
});

export default router;
