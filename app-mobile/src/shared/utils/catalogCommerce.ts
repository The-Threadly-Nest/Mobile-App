export type FulfillmentType = "ready_to_wear" | "custom_fit";
export interface CatalogProduct {
  id: string; fashionHouseId: string; name: string; description: string | null; category: string | null;
  imageUrl: string; priceFrom: number | null; sizes: string[]; colors: string[]; fulfillmentType: FulfillmentType;
  fashionHouse?: { id: string; shopName: string; location?: string | null; timezone?: string };
}
export const catalogOptions = (text: string) => [...new Set(text.split(",").map(value => value.trim()).filter(Boolean))];
export function catalogPrice(text: string): number | null {
  if (!text.trim()) return null;
  const cleaned = text.replace(/[,\s₦]/g, "");
  if (!/^\d+$/.test(cleaned) || Number(cleaned) <= 0 || Number(cleaned) > 2147483647) throw new Error("Enter a valid whole-number price.");
  return Number(cleaned);
}
export function readyItemError(item: Pick<CatalogProduct, "fulfillmentType" | "priceFrom" | "sizes" | "colors">, size: string, color: string): string | null {
  if (item.fulfillmentType !== "ready_to_wear") return "This item needs custom measurements. Book a measurement appointment instead.";
  if (!item.priceFrom || item.priceFrom <= 0) return "This item doesn't have a confirmed price yet.";
  if (!item.sizes.includes(size)) return "Choose an available size.";
  if (item.colors.length ? !item.colors.includes(color) : Boolean(color)) return "Choose an available colour.";
  return null;
}
