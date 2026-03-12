import { describe, expect, it } from 'bun:test';

import { addDays, addMonths, daysUntil, formatCountdown, formatDate } from '../date';

// ── formatDate ──────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a Date object', () => {
    const date = new Date('2026-02-20T00:00:00Z');
    expect(formatDate(date)).toBe('Feb 20, 2026');
  });

  it('formats an ISO string', () => {
    expect(formatDate('2026-12-25T00:00:00Z')).toBe('Dec 25, 2026');
  });

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('\u2014');
  });

  it('uses UTC timezone to avoid timezone issues', () => {
    // A date near midnight UTC — should always format as the UTC date
    const date = new Date('2026-01-01T23:59:59Z');
    expect(formatDate(date)).toBe('Jan 1, 2026');
  });
});

// ── daysUntil ───────────────────────────────────────────────────────

describe('daysUntil', () => {
  it('returns positive number for future dates', () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 5);
    expect(daysUntil(future)).toBe(5);
  });

  it('returns negative number for past dates', () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 3);
    expect(daysUntil(past)).toBe(-3);
  });

  it('returns 0 for today', () => {
    expect(daysUntil(new Date())).toBe(0);
  });

  it('accepts ISO string input', () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 10);
    expect(daysUntil(future.toISOString())).toBe(10);
  });
});

// ── formatCountdown ─────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('returns "Overdue" for past dates', () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 1);
    expect(formatCountdown(past)).toBe('Overdue');
  });

  it('returns "Today" for today', () => {
    expect(formatCountdown(new Date())).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(formatCountdown(tomorrow)).toBe('Tomorrow');
  });

  it('returns "In N days" for dates further out', () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 7);
    expect(formatCountdown(future)).toBe('In 7 days');
  });

  it('accepts ISO string input', () => {
    const future = new Date();
    future.setUTCDate(future.getUTCDate() + 3);
    expect(formatCountdown(future.toISOString())).toBe('In 3 days');
  });
});

// ── addDays ─────────────────────────────────────────────────────────

describe('addDays', () => {
  it('adds positive days', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const result = addDays(date, 10);
    expect(result.toISOString()).toStartWith('2026-01-25');
  });

  it('subtracts with negative days', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const result = addDays(date, -5);
    expect(result.toISOString()).toStartWith('2026-01-10');
  });

  it('crosses month boundary', () => {
    const date = new Date('2026-01-30T00:00:00Z');
    const result = addDays(date, 5);
    expect(result.toISOString()).toStartWith('2026-02-04');
  });

  it('does not mutate the original date', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const original = date.getTime();
    addDays(date, 10);
    expect(date.getTime()).toBe(original);
  });
});

// ── addMonths ───────────────────────────────────────────────────────

describe('addMonths', () => {
  it('adds months to a normal date', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const result = addMonths(date, 2);
    expect(result.toISOString()).toStartWith('2026-03-15');
  });

  it('clamps to last day of month when day overflows', () => {
    // Jan 31 + 1 month → should clamp to Feb 28 (non-leap year)
    const date = new Date('2026-01-31T00:00:00Z');
    const result = addMonths(date, 1);
    expect(result.getUTCMonth()).toBe(1); // February
    expect(result.getUTCDate()).toBe(28);
  });

  it('handles leap year Feb 29 correctly', () => {
    // Jan 31 + 1 month in a leap year (2028) → Feb 29
    const date = new Date('2028-01-31T00:00:00Z');
    const result = addMonths(date, 1);
    expect(result.getUTCMonth()).toBe(1); // February
    expect(result.getUTCDate()).toBe(29);
  });

  it('subtracts months with negative values', () => {
    const date = new Date('2026-03-15T00:00:00Z');
    const result = addMonths(date, -1);
    expect(result.toISOString()).toStartWith('2026-02-15');
  });

  it('crosses year boundary', () => {
    const date = new Date('2026-11-15T00:00:00Z');
    const result = addMonths(date, 3);
    expect(result.getUTCFullYear()).toBe(2027);
    expect(result.getUTCMonth()).toBe(1); // February
  });

  it('does not mutate the original date', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const original = date.getTime();
    addMonths(date, 3);
    expect(date.getTime()).toBe(original);
  });

  it('clamps Mar 31 + 1 month to Apr 30', () => {
    const date = new Date('2026-03-31T00:00:00Z');
    const result = addMonths(date, 1);
    expect(result.getUTCMonth()).toBe(3); // April
    expect(result.getUTCDate()).toBe(30);
  });
});
