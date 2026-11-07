import { BadRequestError } from "../utils/errors";
type Catalog = { id: string; name: string; imageUrl: string; priceFrom: number | null; sizes: string[]; colors: string[]; fulfillmentType: string };
type Requested = { catalogItemId: string; quantity: number; selectedSize: string; selectedColor: string };

export function validateCatalogOffering(item: { fulfillmentType: string; priceFrom: number | null; sizes: string[] }) {
  if (item.fulfillmentType === "ready_to_wear" && (!item.priceFrom || item.priceFrom <= 0 || !item.sizes.length)) throw new BadRequestError("Ready-for-pickup clothes need a price and at least one available size.");
}
export function prepareCatalogOrder(catalog: Catalog[], requested: Requested[]) {
  const byId = new Map(catalog.map(item => [item.id, item]));
  let total = 0;
  const items = requested.map(line => {
    const item = byId.get(line.catalogItemId);
    if (!item) throw new BadRequestError("An item is no longer available from this fashion house. Please refresh your cart.");
    if (item.fulfillmentType !== "ready_to_wear") throw new BadRequestError(`${item.name} is custom fit. Book a measurement appointment instead.`);
    validateCatalogOffering(item);
    if (!item.sizes.includes(line.selectedSize)) throw new BadRequestError(`Choose an available size for ${item.name}.`);
    if (item.colors.length ? !item.colors.includes(line.selectedColor) : Boolean(line.selectedColor)) throw new BadRequestError(`Choose an available colour for ${item.name}.`);
    total += item.priceFrom! * line.quantity;
    if (!Number.isSafeInteger(total) || total > 2147483647) throw new BadRequestError("This order total is too large. Please split it into smaller orders.");
    return { catalogItemId: item.id, name: item.name, imageUrl: item.imageUrl, unitPrice: item.priceFrom!, quantity: line.quantity, selectedSize: line.selectedSize, selectedColor: line.selectedColor };
  });
  return { total, items, itemName: items.map(item => `${item.quantity} × ${item.name} (${[item.selectedSize, item.selectedColor].filter(Boolean).join(", ")})`).join("; ") };
}
