export const GARMENT_CATEGORIES = ["Dress", "Top", "Shirt", "Blouse", "T-shirt", "Trousers", "Jeans", "Shorts", "Skirt", "Suit", "Two-piece set", "Jumpsuit", "Jacket", "Coat", "Kaftan", "Agbada", "Native wear", "Bridal wear", "Kidswear", "Footwear", "Accessories", "Other"];
export const GARMENT_SIZES = ["One size", "XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", ...Array.from({ length: 14 }, (_, i) => String(2 + i * 2)), ...Array.from({ length: 14 }, (_, i) => String(35 + i))];
export const GARMENT_COLORS = ["Black", "White", "Cream", "Ivory", "Beige", "Brown", "Grey", "Navy", "Blue", "Light blue", "Green", "Olive", "Red", "Burgundy", "Pink", "Purple", "Orange", "Yellow", "Gold", "Silver", "Multicolour"];
export function selectedCatalogChoices(value: string): string[] {
  return [...new Set(value.split(",").map(part => part.trim()).filter(Boolean))];
}
export function toggleCatalogChoice(current: string, choice: string): string {
  const values = selectedCatalogChoices(current);
  return (values.includes(choice) ? values.filter(value => value !== choice) : [...values, choice]).join(", ");
}
