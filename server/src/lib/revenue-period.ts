export type RevenuePeriod = "this_month" | "last_month" | "this_year" | "all_time";

// Keep the existing dashboard's UTC calendar boundaries consistent.
export function revenuePeriodRange(period: RevenuePeriod, now = new Date()) {
  const year = now.getUTCFullYear(), month = now.getUTCMonth();
  switch (period) {
    case "this_month": return { gte: new Date(Date.UTC(year, month, 1)), lt: new Date(Date.UTC(year, month + 1, 1)) };
    case "last_month": return { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
    case "this_year": return { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) };
    case "all_time": return undefined;
  }
}
