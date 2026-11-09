export interface CustomerMeasurement { id: string; customerId?: string; field: string; value: number; unit: string; recordedAt?: string; updatedAt?: string; customer?: { fashionHouse?: { id: string; shopName: string; brandLogoUrl?: string | null } } }
export function measurementGroups(rows: CustomerMeasurement[]) {
  const groups = new Map<string, { id: string; name: string; logoUrl: string | null; rows: CustomerMeasurement[] }>();
  const seen = new Set<string>();
  // Insertion order makes the most recently updated house the default selector.
  const sorted = [...rows].sort((a, b) => (Date.parse(b.updatedAt || b.recordedAt || '') || 0) - (Date.parse(a.updatedAt || a.recordedAt || '') || 0));
  for (const row of sorted) {
    if (!row.field?.trim() || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value <= 0) continue;
    const house = row.customer?.fashionHouse;
    const id = house?.id || row.customerId || 'saved';
    const key = id + ':' + row.field.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!groups.has(id)) groups.set(id, { id, name: house?.shopName || 'Saved measurements', logoUrl: house?.brandLogoUrl || null, rows: [] });
    groups.get(id)!.rows.push(row);
  }
  return [...groups.values()];
}
export function measurementLabel(field: string) { return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().replace(/^./, letter => letter.toUpperCase()); }
