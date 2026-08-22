import { Router } from "express";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { createMeasurementSchema } from "@/schemas/measurements.schema";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

// Add Measurement
router.post("/", validate({ body: createMeasurementSchema }), async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { customerId, field, value, unit } = req.body;

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found in your fashion house." });
    }

    const measurement = await prisma.measurement.create({
      data: {
        customerId,
        field,
        value,
        unit,
      },
    });

    res.status(201).json(measurement);
  } catch (err) {
    next(err);
  }
});

// List Measurements for Customer
router.get("/customer/:customerId", async (req, res, next) => {
  try {
    const fhId = await getOwnFashionHouseId(req.authUserId!, req.authRole!);
    const { customerId } = req.params;

    // Tenant Isolation: Verify customer belongs to the tenant
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, fashionHouseId: fhId },
    });
    if (!customer) {
      return res.status(404).json({ error: "Customer not found in your fashion house." });
    }

    const measurements = await prisma.measurement.findMany({
      where: { customerId },
      orderBy: { recordedAt: "desc" },
    });

    res.json(measurements);
  } catch (err) {
    next(err);
  }
});

export default router;
