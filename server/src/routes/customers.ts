import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole, getOwnFashionHouseId } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { collectionPaginationSchema, type CollectionPagination } from "../schemas/pagination.schema";
import { collectionWindow, sendCollectionPage } from "../lib/pagination";

const router = Router();
router.use(requireAuth, requireRole("admin", "staff"));

// GET /api/customers — List all unique customers for this fashion house with aggregated order counts
router.get("/", validate({ query: collectionPaginationSchema }), async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { page, limit } = req.query as unknown as CollectionPagination;
    const { skip, take } = collectionWindow(page, limit);
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      status: string;
      ordersCount: bigint | number;
    }>>`
      WITH "crmCustomers" AS (
        SELECT
          customer."id",
          customer."userId",
          customer."name",
          customer."phone",
          account."email",
          customer."status",
          COUNT(orders."id") AS "ordersCount",
          0 AS "sourcePriority"
        FROM "customers" customer
        LEFT JOIN "users" account ON account."id" = customer."userId"
        LEFT JOIN "orders" orders ON orders."customerId" = customer."id"
        WHERE customer."fashionHouseId" = ${fhId}
        GROUP BY customer."id", account."email"
      ),
      "associatedAccounts" AS (
        SELECT
          account."id",
          account."id" AS "userId",
          COALESCE(NULLIF(TRIM(account."name"), ''), SPLIT_PART(account."email", '@', 1), 'Customer') AS "name",
          NULL::TEXT AS "phone",
          account."email",
          'active'::TEXT AS "status",
          0::BIGINT AS "ordersCount",
          1 AS "sourcePriority"
        FROM "users" account
        WHERE account."role" = 'customer'
          AND (
            EXISTS (SELECT 1 FROM "bookings" booking WHERE booking."customerId" = account."id" AND booking."fashionHouseId" = ${fhId})
            OR EXISTS (SELECT 1 FROM "chat_escalations" escalation WHERE escalation."customerId" = account."id" AND escalation."fashionHouseId" = ${fhId})
            OR EXISTS (SELECT 1 FROM "direct_messages" message WHERE message."customerId" = account."id" AND message."fashionHouseId" = ${fhId})
          )
          AND NOT EXISTS (
            SELECT 1 FROM "customers" customer
            WHERE customer."fashionHouseId" = ${fhId} AND customer."userId" = account."id"
          )
      ),
      "rankedCustomers" AS (
        SELECT combined.*,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(combined."name"))
            ORDER BY combined."sourcePriority", combined."id"
          ) AS "rowNumber"
        FROM (
          SELECT * FROM "crmCustomers"
          UNION ALL
          SELECT * FROM "associatedAccounts"
        ) combined
      )
      SELECT "id", "name", "phone", "email", "status", "ordersCount"
      FROM "rankedCustomers"
      WHERE "rowNumber" = 1
      ORDER BY LOWER("name") ASC, "id" ASC
      LIMIT ${take} OFFSET ${skip}
    `;

    sendCollectionPage(
      res,
      rows.map((row) => ({
        ...row,
        phone: row.phone || "",
        email: row.email || undefined,
        ordersCount: Number(row.ordersCount),
      })),
      page,
      limit
    );
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customers/:id/status — Toggle customer active / inactive lifecycle status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const fhId = getOwnFashionHouseId(req);
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value. Must be 'active' or 'inactive'." });
    }

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, fashionHouseId: fhId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer record not found." });
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id, fashionHouseId: fhId },
      data: { status },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
