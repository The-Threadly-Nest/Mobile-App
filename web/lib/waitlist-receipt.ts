export const WAITLIST_RECEIPT_KEY = "owuja.waitlist.receipt.v1";
export interface WaitlistReceipt { version: 1; referralCode?: string }

export function mergeWaitlistReceipt(raw: string | null, referralCode?: string): WaitlistReceipt {
  const previous = parseWaitlistReceipt(raw);
  return parseWaitlistReceipt(JSON.stringify({ version: 1, referralCode: referralCode ?? previous?.referralCode })) ?? { version: 1 };
}

export function parseWaitlistReceipt(raw: string | null): WaitlistReceipt | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || (value.referralCode !== undefined &&
      (typeof value.referralCode !== "string" || !/^[A-F0-9]{10}$/.test(value.referralCode)))) return null;
    // Never keep email addresses, names, or unsubscribe tokens in browser storage.
    return { version: 1, ...(value.referralCode ? { referralCode: value.referralCode } : {}) };
  } catch { return null; }
}
