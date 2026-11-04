import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { CustomersInput } from "./customers.dto";
import { rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";
import { type CollectionPagination } from "../../schemas/pagination.schema";
import { collectionWindow, collectionPage } from "../../lib/pagination";

// GET /api/customers — List all unique customers for this fashion house with aggregated order counts

// PATCH /api/customers/:id/status — Toggle customer active / inactive lifecycle status

@Injectable()
export class CustomersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async get(input: CustomersInput<"get">) {

    const fhId = getOwnFashionHouseId(input);
    const { page, limit } = input.query as unknown as CollectionPagination;
    const { skip, take } = collectionWindow(page, limit);
    const rows = await this.database.client.$queryRaw<Array<{
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

    return collectionPage(rows.map((row) => ({
      ...row,
      phone: row.phone || "",
      email: row.email || undefined,
      ordersCount: Number(row.ordersCount),
    })), page, limit);

  }

  async patchByIdStatus(input: CustomersInput<"patchByIdStatus">) {

    const fhId = getOwnFashionHouseId(input);
    const { status } = input.body;

    if (!["active", "inactive"].includes(status)) {
      return rejectRequest({ error: "Please choose active or inactive for this customer." }, 400);
    }

    const customer = await this.database.client.customer.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });

    if (!customer) {
      return rejectRequest({ error: "Customer record not found." }, 404);
    }

    const updated = await this.database.client.customer.update({
      where: { id: customer.id, fashionHouseId: fhId },
      data: { status },
    });

    return updated;

  }

}

