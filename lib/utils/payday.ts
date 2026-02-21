// ── Payday detection utilities ──────────────────────────────────────
// Heuristic-based payday detection for smart retry scheduling.
// Common US paydays: Fridays (weekly/biweekly), 1st of month, 15th of month.

/**
 * Check whether a given date is likely a payday.
 * Returns true if the date is a Friday (day 5), the 1st, or the 15th of the month.
 */
export function isLikelyPayday(date: Date): boolean {
  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();

  // Friday = 5
  if (dayOfWeek === 5) return true;

  // 1st or 15th of the month
  if (dayOfMonth === 1 || dayOfMonth === 15) return true;

  return false;
}

/**
 * Get the next likely payday after a given date.
 * Returns the earliest date that is a Friday, 1st, or 15th of the month,
 * at least 1 day after `fromDate`.
 */
export function getNextLikelyPayday(fromDate: Date): Date {
  return getNextLikelyPaydayAfterDays(fromDate, 1);
}

/**
 * Get the next likely payday at least `minDays` after `fromDate`.
 * Iterates day by day starting from `fromDate + minDays` until a
 * likely payday is found.
 *
 * @param fromDate - The reference date
 * @param minDays - Minimum number of days from `fromDate` (must be >= 1)
 * @returns The next Date that passes the `isLikelyPayday` check
 */
export function getNextLikelyPaydayAfterDays(fromDate: Date, minDays: number): Date {
  if (minDays < 1) {
    throw new RangeError('minDays must be at least 1');
  }

  const candidate = new Date(fromDate);
  candidate.setDate(candidate.getDate() + minDays);

  // Safety: limit iteration to 35 days (covers any month + margin)
  for (let i = 0; i < 35; i++) {
    if (isLikelyPayday(candidate)) {
      return candidate;
    }
    candidate.setDate(candidate.getDate() + 1);
  }

  // Fallback: should never reach here since every week has a Friday,
  // but return the candidate if somehow we do.
  return candidate;
}
