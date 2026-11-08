export interface CustomerMeasurement { id: string; customerId?: string; field: string; value: number; unit: string; recordedAt?: string; customer?: { fashionHouse?: { id: string; shopName: string } } }
export function measurementGroups(rows: CustomerMeasurement[]) {
  const groups = new Map<string, { id: string; name: string; rows: CustomerMeasurement[] }>();
  const seen = new Set<string>();
  const sorted = [...rows].sort((a, b) => (Date.parse(b.recordedAt || '') || 0) - (Date.parse(a.recordedAt || '') || 0));
  for (const row of sorted) {
    if (!row.field?.trim() || typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value <= 0) continue;
    const house = row.customer?.fashionHouse;
    const id = house?.id || row.customerId || 'saved';
    const key = id + ':' + row.field.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!groups.has(id)) groups.set(id, { id, name: house?.shopName || 'Saved measurements', rows: [] });
    groups.get(id)!.rows.push(row);
  }
  return [...groups.values()];
}
export function measurementLabel(field: string) { return field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().replace(/^./, letter => letter.toUpperCase()); }
