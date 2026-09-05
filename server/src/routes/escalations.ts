import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { escalationIdParamSchema, resolveEscalationSchema } from "../schemas/escalation.schema";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

async function getAdminFashionHouseOrThrow(userId: string) {
  const admin = await prisma.user.findUnique({ where: { id: userId }, include: { fashionHouseOwned: true } });
  if (!admin) {
    throw Object.assign(new Error("Your session has expired. Please log in again."), { status: 401 });
  }
  if (admin.role !== "admin") {
    throw Object.assign(new Error("Admin access required"), { status: 403 });
  }
  if (!admin.fashionHouseOwned) {
    throw Object.assign(new Error("Fashion house not found for this admin"), { status: 404 });
  }
  return admin.fashionHouseOwned;
}

router.get("/", async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const [escalations, bookings] = await Promise.all([
      prisma.chatEscalation.findMany({
        where: { fashionHouseId: fh.id },
        orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
        include: { customer: { select: { id: true, name: true, email: true } } },
      }),
      prisma.booking.findMany({
        where: { fashionHouseId: fh.id },
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          order: { select: { id: true, staffId: true, status: true } },
        },
      }),
    ]);

    const formattedBookings = bookings.map((b) => {
      // Source of truth: a booking is "assigned" if an Order has been created for it,
      // OR if the booking.status was explicitly set to assigned/completed.
      // This is resilient to the booking.status update failing silently.
      const hasOrder = !!b.order;
      const orderStatus = b.order?.status;

      let bookingStatus: string;
      if (hasOrder && (orderStatus === "completed" || orderStatus === "delivered")) {
        bookingStatus = "completed";
      } else if (hasOrder || b.status === "assigned") {
        bookingStatus = "assigned";
      } else if (b.status === "declined") {
        bookingStatus = "declined";
      } else {
        bookingStatus = "pending";
      }

      return {
        id: b.id,
        fashionHouseId: b.fashionHouseId,
        customerId: b.customerId,
        customerName: b.customer?.name || b.customer?.email?.split("@")[0] || "Customer",
        reason: b.styleNotes || "Bespoke Fitting Appointment",
        summary: `Appointment requested for ${b.preferredTime} on ${new Date(b.preferredDate).toLocaleDateString()}.`,
        preferredDate: b.preferredDate.toISOString(),
        preferredTime: b.preferredTime,
        resolved: hasOrder || b.status === "assigned" || b.status === "completed" || b.status === "declined",
        bookingStatus,
        createdAt: b.createdAt.toISOString(),
        customer: b.customer,
      };
    });

    const formattedEscalations = escalations.map((e) => ({
      id: e.id,
      fashionHouseId: e.fashionHouseId,
      customerId: e.customerId,
      customerName: e.customer?.name || e.customer?.email?.split("@")[0] || "Customer",
      reason: e.reason,
      summary: e.summary,
      resolved: e.resolved,
      createdAt: e.createdAt.toISOString(),
      customer: e.customer,
    }));

    // Deduplicate combined list by id or customerId+reason
    const combined = [...formattedBookings, ...formattedEscalations];
    const seen = new Set<string>();
    const deduplicated = combined.filter((item) => {
      const key = item.id || `${item.customerId}-${item.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    res.json(deduplicated);
  } catch (err) {
    next(err);
  }
});

router.get("/:escalationId", validate({ params: escalationIdParamSchema }), async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const escalation = await prisma.chatEscalation.findFirst({
      where: { id: req.params.escalationId, fashionHouseId: fh.id },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!escalation) return res.status(404).json({ error: "Escalation not found" });

    const measurements = await prisma.measurement.findMany({
      where: {
        OR: [
          { customerId: escalation.customerId },
          { customer: { userId: escalation.customerId } },
        ],
      },
      orderBy: { recordedAt: "desc" },
    });

    let transcript: unknown[] = [];
    try { transcript = JSON.parse(escalation.transcript); } catch {}
    res.json({
      ...escalation,
      customer: {
        ...escalation.customer,
        measurements,
      },
      transcript,
    });
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

// PATCH /api/escalations/:escalationId/decline
// Works for both Booking records (sets status="declined") and ChatEscalation records (sets resolved=true as a fallback).
router.patch("/:escalationId/decline", async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const { escalationId } = req.params;

    // 1. Try to decline a Booking (has a proper "declined" status value)
    const bookingResult = await prisma.booking.updateMany({
      where: { id: escalationId, fashionHouseId: fh.id },
      data: { status: "declined" },
    });

    if (bookingResult.count > 0) {
      return res.json({ success: true, type: "booking" });
    }

    // 2. Fall back to resolving a ChatEscalation (no dedicated declined state in schema)
    const escalationResult = await prisma.chatEscalation.updateMany({
      where: { id: escalationId, fashionHouseId: fh.id },
      data: { resolved: true },
    });

    if (escalationResult.count > 0) {
      return res.json({ success: true, type: "escalation" });
    }

    return res.status(404).json({ error: "Booking or escalation not found." });
  } catch (err) {
    next(err);
  }
});

router.post("/assign", async (req, res, next) => {
  try {
    const fh = await getAdminFashionHouseOrThrow(req.authUserId!);
    const { bookingId, staffId, serviceTitle, customerName, price, measurements } = req.body;

    let validStaffId: string | null = null;
    if (staffId && typeof staffId === "string" && !staffId.startsWith("t")) {
      const staffUser = await prisma.user.findFirst({
        where: { id: staffId, fashionHouseId: fh.id, role: "staff" },
      });
      if (staffUser) validStaffId = staffUser.id;
    }

    let targetCustomerId: string | null = null;
    if (bookingId && !bookingId.startsWith("demo-")) {
      const dbBooking = await prisma.booking.findFirst({
        where: { id: bookingId, fashionHouseId: fh.id },
        select: { customerId: true },
      });
      if (dbBooking?.customerId) {
        // Verify this ID actually exists in the Customer table (not a User ID)
        const verifiedCustomer = await prisma.customer.findUnique({
          where: { id: dbBooking.customerId },
          select: { id: true },
        });
        if (verifiedCustomer) {
          targetCustomerId = verifiedCustomer.id;
        }
      }
    }

    if (!targetCustomerId && customerName) {
      let customer = await prisma.customer.findFirst({
        where: { name: { equals: customerName, mode: "insensitive" }, fashionHouseId: fh.id },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            fashionHouseId: fh.id,
            name: customerName,
          },
        });
      }
      targetCustomerId = customer.id;
    }

    if (!targetCustomerId) {
      let customer = await prisma.customer.findFirst({
        where: { fashionHouseId: fh.id },
      });
      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            fashionHouseId: fh.id,
            name: customerName || "Customer",
          },
        });
      }
      targetCustomerId = customer.id;
    }

    const parsedPrice = typeof price === "number" && !isNaN(price) && price >= 0 ? price : 0;
    const cleanBookingId = bookingId && !bookingId.startsWith("demo-") ? bookingId : null;

    // 1. Check if an order already exists for this specific booking
    let existingOrder = cleanBookingId
      ? await prisma.order.findFirst({
          where: {
            fashionHouseId: fh.id,
            bookingId: cleanBookingId,
          },
        })
      : null;

    let order;
    const initialStatus =
      measurements && typeof measurements === "object" && (measurements.bust || measurements.waist || measurements.hip)
        ? "measurements_confirmed"
        : "booked";

    if (existingOrder) {
      order = await prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          staffId: validStaffId,
          bookingId: cleanBookingId ?? existingOrder.bookingId,
          itemName: serviceTitle || existingOrder.itemName,
          price: parsedPrice > 0 ? parsedPrice : existingOrder.price,
          status: initialStatus,
        },
      });
    } else {
      order = await prisma.order.create({
        data: {
          fashionHouseId: fh.id,
          customerId: targetCustomerId,
          bookingId: cleanBookingId,
          itemName: serviceTitle || "Bespoke Fitting",
          price: parsedPrice,
          staffId: validStaffId,
          status: initialStatus,
        },
      });
    }

    // 2. Save customer measurements if provided during assignment
    if (measurements && typeof measurements === "object") {
      const { bust, waist, hip, length } = measurements;
      const mList = [
        { field: "Bust", val: bust },
        { field: "Waist", val: waist },
        { field: "Hips", val: hip },
        { field: "Garment Length", val: length },
      ];

      for (const m of mList) {
        if (m.val && !isNaN(Number(m.val))) {
          await prisma.measurement.create({
            data: {
              customerId: targetCustomerId,
              field: m.field,
              value: Number(m.val),
              unit: "in",
            },
          }).catch(() => {});
        }
      }
    }

    // 3. Mark booking request and chat escalation as assigned in database
    if (bookingId && !bookingId.startsWith("demo-")) {
      await prisma.booking.updateMany({
        where: { id: bookingId, fashionHouseId: fh.id },
        data: { status: "assigned" },
      }).catch(() => {});

      await prisma.chatEscalation.updateMany({
        where: { id: bookingId, fashionHouseId: fh.id },
        data: { resolved: true },
      }).catch(() => {});
    } else {
      // If bookingId is demo or unassigned, resolve pending escalations for this fashion house
      await prisma.chatEscalation.updateMany({
        where: { fashionHouseId: fh.id, resolved: false },
        data: { resolved: true },
      }).catch(() => {});
    }

    res.json({ success: true, order });
  } catch (err: any) {
    console.error("[assign] Error details:", {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack,
    });
    next(err);
  }
});

export default router;
