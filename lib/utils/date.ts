// ── Date formatting and countdown helpers ───────────────────────────

/**
 * Format a date value for display.
 *
 * Uses an explicit UTC timezone so the formatted string is identical on
 * server (typically UTC) and client (user's local timezone), avoiding
 * React hydration mismatches.
 *
 * @param date - Date object, ISO string, or null
 * @returns Formatted date string (e.g., "Feb 20, 2026") or an em-dash for null
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '\u2014';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Calculate the number of days from today until a target date.
 *
 * Uses UTC day boundaries so the result is identical on server and
 * client regardless of local timezone, preventing React hydration
 * mismatches.
 *
 * @param date - Target date
 * @returns Number of calendar days (positive = future, negative = past)
 */
export function daysUntil(date: Date | string): number {
  const now = new Date();
  const nowUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(date);
  const targetUtcDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUtcDay - nowUtcDay) / (1000 * 60 * 60 * 24));
}

/**
 * Return a human-readable countdown string for a target date.
 *
 * @param date - Target date
 * @returns "Overdue", "Today", "Tomorrow", or "In N days"
 */
export function formatCountdown(date: Date | string): string {
  const days = daysUntil(date);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}
