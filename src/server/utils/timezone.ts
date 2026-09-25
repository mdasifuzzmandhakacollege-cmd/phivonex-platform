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
 * Returns the previous business date in Asia/Dhaka formatted as 'YYYY-MM-DD'.
 * At midnight Dhaka (00:00 Asia/Dhaka), this is the business date that just closed.
 */
export function getPreviousDhakaBusinessDate(date: Date = new Date()): string {
  const currentDhakaStr = getDhakaBusinessDate(date);
  const [year, month, day] = currentDhakaStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

/**
 * Calculates the exact next 00:00 Asia/Dhaka occurrence and milliseconds until then.
 * Asia/Dhaka is UTC+6 year-round, so 00:00 Asia/Dhaka is always 18:00:00 UTC.
 */
export function getNextDhakaMidnightTime(from: Date = new Date()): {
  nextMidnightIso: string;
  msUntilMidnight: number;
} {
  const currentDhakaStr = getDhakaBusinessDate(from);
  const [year, month, day] = currentDhakaStr.split('-').map(Number);
  // Next midnight in Dhaka occurs when Dhaka date becomes tomorrow 00:00:00.
  // Tomorrow's date in Dhaka:
  const tomorrow = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const nextDhakaDateStr = tomorrow.toISOString().split('T')[0];
  const [nextYear, nextMonth, nextDay] = nextDhakaDateStr.split('-').map(Number);

  // 00:00:00 in Dhaka (UTC+6) corresponds to:
  // Date.UTC(nextYear, nextMonth - 1, nextDay, 0, 0, 0) - 6 * 3600 * 1000
  const nextMidnightUtcMs = Date.UTC(nextYear, nextMonth - 1, nextDay, 0, 0, 0) - (6 * 60 * 60 * 1000);
  const nextMidnightDate = new Date(nextMidnightUtcMs);
  const diffMs = Math.max(0, nextMidnightDate.getTime() - from.getTime());

  return {
    nextMidnightIso: nextMidnightDate.toISOString(),
    msUntilMidnight: diffMs,
  };
}

/**
 * Returns current timestamp in ISO format
 */
export function getNowIso(): string {
  return new Date().toISOString();
}

