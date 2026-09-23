/**
 * Phivonex Timezone & Business Date Utility
 * Authoritative daily settlement & business date timezone: Asia/Dhaka
 */

export const PHIVONEX_BUSINESS_TIMEZONE = 'Asia/Dhaka';

/**
 * Returns the authoritative business date in Asia/Dhaka formatted as 'YYYY-MM-DD'.
 * Accepts an optional Date instance (e.g. for historical node activations or backfills).
 */
export function getDhakaBusinessDate(date: Date = new Date()): string {
  // Intl DateTimeFormat with 'en-CA' locale produces standard 'YYYY-MM-DD'
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PHIVONEX_BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns current timestamp in ISO format
 */
export function getNowIso(): string {
  return new Date().toISOString();
}
