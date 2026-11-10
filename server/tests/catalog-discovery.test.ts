import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { CatalogService } = require("../dist/src/modules/catalog/catalog.service");
const { catalogInputs } = require("../dist/src/modules/catalog/catalog.dto");

test("marketplace preserves validated filter values and applies them before pagination", async () => {
  for (const sort of ["newest", "price_asc", "price_desc"]) {
    let query: any;
    const service = new CatalogService({ client: { catalogItem: { findMany: async (args: any) => { query = args; return []; } } } });
    const input = catalogInputs.getMarketplace.query.parse({ fulfillmentType: "ready_to_wear", sort, page: "2", limit: "20" });
    await service.getMarketplace({ query: input });
    assert.equal(query.where.fulfillmentType, "ready_to_wear");
    assert.equal(query.skip, 20);
    assert.deepEqual(query.orderBy[0], sort === "newest" ? { createdAt: "desc" } : { priceFrom: sort === "price_asc" ? "asc" : "desc" });
  }
  assert.throws(() => catalogInputs.getMarketplace.query.parse({ fulfillmentType: "invalid" }));
});
