// ── Date formatting and countdown helpers ───────────────────────────

/**
 * Format a date value for display.
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
  });
}

/**
 * Calculate the number of days from today until a target date.
 * Both dates are normalized to midnight before comparison so
 * the result is independent of the current time of day.
 *
 * @param date - Target date
 * @returns Number of calendar days (positive = future, negative = past)
 */
export function daysUntil(date: Date | string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
