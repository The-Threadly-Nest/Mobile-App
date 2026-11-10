type CatalogFilterItem = { fulfillmentType?: string | null; priceFrom?: number | null; price?: number | null; createdAt?: string | null };

/** Keep visible cards consistent with the selected filter while a fresh page loads. */
export function filterCatalogItems<T extends CatalogFilterItem>(items: T[], type: string, sort: string): T[] {
  const filtered = items.filter(item => !type || (item.fulfillmentType || "custom_fit") === type);
  const price = (item: T) => item.priceFrom ?? item.price;
  if (sort === "price_asc" || sort === "price_desc") {
    filtered.sort((a, b) => {
      const left = price(a), right = price(b);
      if (left == null) return right == null ? 0 : 1;
      if (right == null) return -1;
      return sort === "price_asc" ? left - right : right - left;
    });
  } else if (items.every(item => item.createdAt)) {
    filtered.sort((a, b) => Date.parse(b.createdAt!) - Date.parse(a.createdAt!));
  }
  return filtered;
}
