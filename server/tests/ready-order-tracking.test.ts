import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { OrdersService } = require("../dist/src/modules/orders/orders.service");
const { isReadyOrder, readyOrderProgress, readyOrderLabel } = require("../dist/src/lib/order-fulfillment");

test("ready-to-wear tracking has its own progress and includes purchased sizes and pickup details", async () => {
  const items = [{ catalogItemId: "shirt", name: "Shirt", quantity: 2, selectedSize: "M", selectedColor: "Black", unitPrice: 15000 }];
  const order = { id: "order", status: "in_production", itemName: "2 shirts", items, price: 30000, fashionHouseId: "house", customer: { userId: "customer", name: "Customer" }, fashionHouse: { shopName: "Atelier", location: "Lagos", catalogItems: [] }, updatedAt: new Date() };
  const service = new OrdersService({ client: { booking: { findFirst: async () => null }, order: { findFirst: async ({ where }: any) => {
    assert.equal(where.customer.userId, "customer"); return order;
  } } } });
  const response = await service.getTrackById({ authUserId: "customer", authRole: "customer", params: { id: "order" } });
  assert.equal(response.fulfillmentType, "ready_to_wear");
  assert.deepEqual(response.items, items);
  assert.equal(response.progressPercent, 50);
  assert.equal(response.estimatedReady, "Preparing your order");
  assert.equal(response.fashionHouseLocation, "Lagos");
  order.status = "ready_for_pickup";
  assert.equal((await service.getTrackById({ authUserId: "customer", authRole: "customer", params: { id: "order" } })).progressPercent, 75);
});

test("pickup is not completion, and custom-fit orders are not classified as ready-to-wear", () => {
  assert.equal(isReadyOrder(null), false);
  assert.equal(isReadyOrder([]), false);
  assert.equal(isReadyOrder([{ name: "Custom suit" }]), false);
  assert.equal(isReadyOrder([{ selectedSize: "M" }]), true);
  assert.equal(readyOrderProgress("order_placed"), 25);
  assert.equal(readyOrderProgress("ready_for_pickup"), 75);
  assert.equal(readyOrderProgress("completed"), 100);
  assert.equal(readyOrderProgress("cancelled"), 0);
  assert.equal(readyOrderLabel("in_production"), "Preparing your order");
});
