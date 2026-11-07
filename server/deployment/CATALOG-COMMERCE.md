# Catalog purchase and measurement flows

The additive migration `20261107020000_catalog_order_flows` adds catalog fulfillment type, immutable order item snapshots and measurement-booking references. Run the existing `npm run db:deploy` on the **server service**, with its existing migration database credentials, before using these endpoints. No database reset or Railway configuration change is needed.

Existing catalog items default to `custom_fit`. In the admin catalog editor, explicitly choose **Ready for pickup**, publish a price and available sizes to allow cart checkout. Publish colours if customers must choose one. Custom-fit items use the fashion house's existing available schedule for direct measurement appointments, without AI chat.

Ready-for-pickup checkout creates an unpaid order. It does not charge a card, implement stock quantities, or create a withdrawable wallet balance. Measurements reserve a real available slot and appear in the admin booking requests and customer orders.

Manual device checks after migration:

1. Upload one ready-for-pickup garment and one custom-fit garment from the admin account.
2. From a customer account, select a real size/colour, add the ready garment to cart and place its order. Confirm the admin sees the real item and total.
3. Open the custom garment, book an available measurement time, and confirm both accounts see the appointment. A second customer cannot claim that same time.
4. Retry a submission after a network interruption: the same idempotency key returns the existing result instead of creating a duplicate.

Automated tests use mocked database/provider calls; they do not validate a deployed database or replace device checks.
