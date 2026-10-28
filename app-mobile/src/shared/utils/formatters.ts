const DEFAULT_LOCALE = "en-NG";

export const formatDate = (
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions
): string => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(DEFAULT_LOCALE, options);
};

export const formatCurrency = (
  amount: number | null | undefined,
  currency = "NGN"
): string => {
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toLocaleString(DEFAULT_LOCALE)}`;
  }
};

export const formatShortDate = (value: string | number | Date | null | undefined): string => {
  return formatDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatMonthYear = (value: string | number | Date): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(DEFAULT_LOCALE, { month: "long", year: "numeric" });
};

export const formatChatDate = (value: string | number | Date): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(DEFAULT_LOCALE, { day: "numeric", month: "short" });
};
