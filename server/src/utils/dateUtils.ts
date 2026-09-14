export function parseFittingDate(fittingDate?: string | null): Date {
  if (!fittingDate || typeof fittingDate !== "string") return new Date();
  
  const cleaned = fittingDate
    .replace(/·/g, " ")
    .replace(/\sat\s/i, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  let d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d;

  const currentYear = new Date().getFullYear();
  d = new Date(`${cleaned} ${currentYear}`);
  if (!isNaN(d.getTime())) return d;

  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  
  const match = cleaned.match(/(?:([0-9]{1,2})\s+([a-zA-Z]{3,9})|([a-zA-Z]{3,9})\s+([0-9]{1,2}))(?:\s+([0-9]{1,2}):([0-9]{2})\s*(AM|PM)?)?/i);
  if (match) {
    const day = parseInt(match[1] || match[4], 10);
    const monthStr = (match[2] || match[3]).toLowerCase().slice(0, 3);
    const monthIndex = months[monthStr];
    
    if (!isNaN(day) && monthIndex !== undefined) {
      let hours = match[5] ? parseInt(match[5], 10) : 10;
      const minutes = match[6] ? parseInt(match[6], 10) : 0;
      const ampm = match[7] ? match[7].toUpperCase() : null;
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      
      const target = new Date();
      target.setFullYear(currentYear, monthIndex, day);
      target.setHours(hours, minutes, 0, 0);
      return target;
    }
  }

  return new Date();
}

export function formatEstimatedReady(preferredTime?: string | null, preferredDate?: Date | string | null): string {
  if (!preferredTime && !preferredDate) return "Fitting in 2 weeks";

  let dateStr = "";
  if (preferredDate) {
    try {
      const d = new Date(preferredDate);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
    } catch (_) {}
  }

  const timeStr = (preferredTime || "").trim();
  if (timeStr.includes("·") || timeStr.includes(",")) {
    return timeStr.startsWith("Fitting") ? timeStr : `Fitting: ${timeStr}`;
  }

  if (dateStr && timeStr) {
    return `Fitting: ${dateStr} at ${timeStr}`;
  }
  if (dateStr) {
    return `Fitting: ${dateStr}`;
  }
  if (timeStr) {
    return `Fitting: ${timeStr}`;
  }
  return "Fitting in 2 weeks";
}
