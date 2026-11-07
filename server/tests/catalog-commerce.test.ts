import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
const { prepareCatalogOrder, validateCatalogOffering } = require("../dist/src/lib/catalog-commerce");
const { catalogCheckoutSchema, measurementBookingSchema } = require("../dist/src/schemas/orders.schema");
const { OrdersService } = require("../dist/src/modules/orders/orders.service");
const notifications = require("../dist/src/lib/notifications");
const product = () => ({ id: "item", fashionHouseId: "house", name: "Linen shirt", imageUrl: "https://example.com/shirt.png", priceFrom: 15000, sizes: ["M", "L"], colors: ["Black"], fulfillmentType: "ready_to_wear" });
const line = () => ({ catalogItemId: "item", quantity: 2, selectedSize: "M", selectedColor: "Black" });

test("checkout uses current server prices and preserves purchased item snapshots", () => {
  const item = product();
  const order = prepareCatalogOrder([item], [line()]);
  assert.equal(order.total, 30000);
  assert.equal(order.items[0].unitPrice, 15000);
  item.name = "Changed later";
  assert.equal(order.items[0].name, "Linen shirt");
});
test("checkout rejects custom fit, other houses' items, invalid sizes and colours", () => {
  assert.throws(() => prepareCatalogOrder([{ ...product(), fulfillmentType: "custom_fit" }], [line()]), /measurement/);
  assert.throws(() => prepareCatalogOrder([], [line()]), /no longer available/);
  assert.throws(() => prepareCatalogOrder([product()], [{ ...line(), selectedSize: "XL" }]), /size/);
  assert.throws(() => prepareCatalogOrder([product()], [{ ...line(), selectedColor: "Blue" }]), /colour/);
  assert.throws(() => prepareCatalogOrder([{ ...product(), colors: [] }], [line()]), /colour/);
});
test("ready garments require price and sizes; oversized orders fail safely", () => {
  for (const patch of [{ priceFrom: null }, { priceFrom: 0 }, { sizes: [] }]) assert.throws(() => validateCatalogOffering({ ...product(), ...patch }));
  assert.doesNotThrow(() => validateCatalogOffering({ ...product(), fulfillmentType: "custom_fit", priceFrom: null, sizes: [] }));
  assert.throws(() => prepareCatalogOrder([{ ...product(), priceFrom: 2147483647 }], [line()]), /too large/);
});
test("HTTP input schemas reject invalid IDs, quantities and oversized notes", () => {
  assert.equal(catalogCheckoutSchema.safeParse({ fashionHouseId: "bad", items: [line()] }).success, false);
  assert.equal(measurementBookingSchema.safeParse({ catalogItemId: "bad", availableSlotId: "bad" }).success, false);
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(catalogCheckoutSchema.safeParse({ fashionHouseId: id, items: [{ ...line(), catalogItemId: id, quantity: 21 }] }).success, false);
  assert.equal(measurementBookingSchema.safeParse({ catalogItemId: id, availableSlotId: id, notes: "x".repeat(1001) }).success, false);
});
test("measurement booking claims the item's house slot, persists its purpose, and replays without duplicates", async (t) => {
  const original = notifications.sendNotificationToAdmin;
  notifications.sendNotificationToAdmin = async () => {};
  t.after(() => { notifications.sendNotificationToAdmin = original; });
  let saved: any = null, claims = 0;
  const tx = {
    catalogItem: { findUnique: async () => ({ ...product(), fulfillmentType: "custom_fit" }) },
    availableSlot: {
      updateMany: async (args: any) => { claims++; assert.equal(args.where.fashionHouseId, "house"); assert.equal(args.where.booked, false); assert.equal(args.where.active, true); assert.ok(args.where.startsAt.gt instanceof Date); assert.deepEqual(args.where.booking, { is: null }); return { count: 1 }; },
      findUniqueOrThrow: async () => ({ startsAt: new Date("2030-01-01T09:00:00Z"), time: "10:00" }),
    },
    booking: { create: async (args: any) => { saved = { id: "booking", ...args.data }; return saved; } },
  };
  const client = { booking: { findFirst: async () => saved }, $transaction: async (fn: any) => fn(tx) };
  const service = new OrdersService({ client });
  const input = { authUserId: "customer", headers: { "idempotency-key": "measurement-test-123" }, body: { catalogItemId: "item", availableSlotId: "slot" } };
  assert.equal((await service.postMeasurementBooking(input)).status, 201);
  assert.equal(saved.purpose, "measurement");
  assert.equal(saved.customerId, "customer");
  assert.equal(saved.fashionHouseId, "house");
  assert.equal(saved.catalogSnapshot.name, "Linen shirt");
  assert.equal((await service.postMeasurementBooking(input)).status, 200);
  assert.equal(claims, 1);
  await assert.rejects(() => service.postMeasurementBooking({ ...input, body: { ...input.body, availableSlotId: "another" } }), /already used/);
});
test("measurement rejects pickup garments and unavailable slots before creating a booking", async () => {
  for (const ready of [true, false]) {
    let creates = 0;
    const tx = { catalogItem: { findUnique: async () => ({ ...product(), fulfillmentType: ready ? "ready_to_wear" : "custom_fit" }) }, availableSlot: { updateMany: async () => ({ count: 0 }) }, booking: { create: async () => { creates++; } } };
    const service = new OrdersService({ client: { booking: { findFirst: async () => null }, $transaction: async (fn: any) => fn(tx) } });
    await assert.rejects(() => service.postMeasurementBooking({ authUserId: "customer", headers: { "idempotency-key": "measurement-test-456" }, body: { catalogItemId: "item", availableSlotId: "slot" } }), ready ? /ready for pickup/ : /no longer available/);
    assert.equal(creates, 0);
  }
});

test("admin catalog saves fulfillment and published options under the authenticated house", async () => {
  const { CatalogService } = require("../dist/src/modules/catalog/catalog.service");
  let saved: any;
  const service = new CatalogService({ client: { catalogItem: { create: async (args: any) => { saved = args.data; return { id: "item", ...saved }; } } } });
  const response = await service.post({ authRole: "admin", authFashionHouseId: "house", body: product() });
  assert.equal(response.status, 201);
  assert.equal(saved.fashionHouseId, "house");
  assert.equal(saved.fulfillmentType, "ready_to_wear");
  assert.deepEqual(saved.sizes, ["M", "L"]);
  assert.deepEqual(saved.colors, ["Black"]);
  await assert.rejects(() => service.post({ authRole: "admin", authFashionHouseId: "house", body: { ...product(), sizes: [] } }), /available size/);
});
test("checkout creates a real server-priced order and repeats the same request only once", async (t) => {
  const original = notifications.sendNotificationToAdmin;
  notifications.sendNotificationToAdmin = async () => {};
  t.after(() => { notifications.sendNotificationToAdmin = original; });
  let saved: any = null, creates = 0;
  const tx = {
    catalogItem: { findMany: async (args: any) => { assert.equal(args.where.fashionHouseId, "house"); return [product()]; } },
    user: { findUnique: async () => ({ name: "Customer" }) },
    fashionHouse: { findUnique: async () => ({ id: "house" }) },
    customer: { findFirst: async () => ({ id: "customer-record" }) },
    order: { create: async (args: any) => { creates++; saved = { id: "order", ...args.data }; return saved; } },
  };
  const service = new OrdersService({ client: { order: { findFirst: async (args: any) => { assert.deepEqual(args.where.customer, { userId: "customer" }); return saved; } }, $transaction: async (fn: any) => fn(tx) } });
  const input = { authUserId: "customer", headers: { "idempotency-key": "checkout-test-123" }, body: { fashionHouseId: "house", items: [{ ...line(), price: 1 }] } };
  assert.equal((await service.postCatalogCheckout(input)).status, 201);
  assert.equal(saved.price, 30000);
  assert.equal(saved.items[0].selectedSize, "M");
  assert.equal(saved.status, "order_placed");
  assert.equal((await service.postCatalogCheckout(input)).status, 200);
  assert.equal(creates, 1);
});
