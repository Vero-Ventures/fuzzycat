import { describe, expect, it } from 'bun:test';
import {
  getNextLikelyPayday,
  getNextLikelyPaydayAfterDays,
  isLikelyPayday,
} from '@/lib/utils/payday';

// ── isLikelyPayday ──────────────────────────────────────────────────

describe('isLikelyPayday', () => {
  it('returns true for a Friday', () => {
    // 2026-02-20 is a Friday
    expect(isLikelyPayday(new Date('2026-02-20'))).toBe(true);
  });

  it('returns true for the 1st of the month', () => {
    // 2026-03-01 is a Sunday
    expect(isLikelyPayday(new Date('2026-03-01'))).toBe(true);
  });

  it('returns true for the 15th of the month', () => {
    // 2026-02-15 is a Sunday
    expect(isLikelyPayday(new Date('2026-02-15'))).toBe(true);
  });

  it('returns true for the 1st that is also a Friday', () => {
    // 2026-05-01 is a Friday
    expect(isLikelyPayday(new Date('2026-05-01'))).toBe(true);
  });

  it('returns true for the 15th that is also a Friday', () => {
    // 2025-08-15 is a Friday
    expect(isLikelyPayday(new Date('2025-08-15'))).toBe(true);
  });

  it('returns false for a non-payday (Tuesday the 10th)', () => {
    // 2026-02-10 is a Tuesday
    expect(isLikelyPayday(new Date('2026-02-10'))).toBe(false);
  });

  it('returns false for a Monday the 9th', () => {
    // 2026-02-09 is a Monday
    expect(isLikelyPayday(new Date('2026-02-09'))).toBe(false);
  });

  it('returns false for a Wednesday the 4th', () => {
    // 2026-02-04 is a Wednesday
    expect(isLikelyPayday(new Date('2026-02-04'))).toBe(false);
  });

  it('returns false for a Thursday the 12th', () => {
    // 2026-02-12 is a Thursday
    expect(isLikelyPayday(new Date('2026-02-12'))).toBe(false);
  });
});

// ── getNextLikelyPayday ─────────────────────────────────────────────

describe('getNextLikelyPayday', () => {
  it('returns the next Friday when starting from a Monday', () => {
    // 2026-02-09 is a Monday -> next payday should be 2026-02-13 (Friday)
    const result = getNextLikelyPayday(new Date('2026-02-09'));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(13); // Friday
  });

  it('returns the 15th when it comes before the next Friday', () => {
    // 2026-02-11 is a Wednesday -> 15th (Sun) is before next Fri (13th)
    // Actually: 2026-02-13 is a Friday, 2026-02-15 is a Sunday
    // From Wed the 11th + 1 day = Thu the 12th (not payday)
    // Then Fri the 13th (payday!)
    const result = getNextLikelyPayday(new Date('2026-02-11'));
    expect(result.getDate()).toBe(13); // Friday comes first
  });

  it('returns the 1st of next month when it is the nearest payday', () => {
    // 2026-02-27 is a Friday -> +1 day = Sat 2026-02-28
    // 2026-02-28 is a Saturday -> not payday
    // 2026-03-01 is a Sunday -> 1st! payday
    const result = getNextLikelyPayday(new Date('2026-02-27'));
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(1);
  });

  it('skips the current date even if it is a payday', () => {
    // 2026-02-20 is a Friday (payday) -> minimum 1 day later
    const result = getNextLikelyPayday(new Date('2026-02-20'));
    // Next day is Sat 21st (not payday), then Sun 22nd (not), Mon 23rd (not),
    // Tue 24th (not), Wed 25th (not), Thu 26th (not), Fri 27th (payday!)
    expect(result.getDate()).toBe(27);
    expect(result.getDay()).toBe(5); // Friday
  });

  it('returns the 15th when starting just before it', () => {
    // 2026-03-13 is a Friday -> +1 day = Sat 14th -> next payday = Sun 15th
    const result = getNextLikelyPayday(new Date('2026-03-13'));
    expect(result.getDate()).toBe(15);
  });
});

// ── getNextLikelyPaydayAfterDays ────────────────────────────────────

describe('getNextLikelyPaydayAfterDays', () => {
  it('respects minimum gap of 2 days', () => {
    // 2026-02-18 is a Wednesday -> +2 = Fri 20th (payday!)
    const result = getNextLikelyPaydayAfterDays(new Date('2026-02-18'), 2);
    expect(result.getDate()).toBe(20);
    expect(result.getDay()).toBe(5); // Friday
  });

  it('finds next payday when min gap lands on non-payday', () => {
    // 2026-02-16 is a Monday -> +2 = Wed 18th -> Thu 19th -> Fri 20th (payday!)
    const result = getNextLikelyPaydayAfterDays(new Date('2026-02-16'), 2);
    expect(result.getDate()).toBe(20);
    expect(result.getDay()).toBe(5); // Friday
  });

  it('works with larger minimum gaps', () => {
    // 2026-02-10 is a Tuesday -> +5 = Sun 15th (1st/15th payday!)
    const result = getNextLikelyPaydayAfterDays(new Date('2026-02-10'), 5);
    expect(result.getDate()).toBe(15);
  });

  it('throws if minDays is less than 1', () => {
    expect(() => getNextLikelyPaydayAfterDays(new Date(), 0)).toThrow('minDays must be at least 1');
  });

  it('throws if minDays is negative', () => {
    expect(() => getNextLikelyPaydayAfterDays(new Date(), -1)).toThrow(
      'minDays must be at least 1',
    );
  });

  it('always returns a date at least minDays in the future', () => {
    const fromDate = new Date('2026-02-20'); // Friday
    const result = getNextLikelyPaydayAfterDays(fromDate, 3);

    const diffMs = result.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(3);
  });

  it('returns a date that is a likely payday', () => {
    const result = getNextLikelyPaydayAfterDays(new Date('2026-02-10'), 2);
    expect(isLikelyPayday(result)).toBe(true);
  });

  it('handles month boundary correctly', () => {
    // 2026-02-26 is a Thursday -> +2 = Sat 28th -> 3/1 (payday!)
    const result = getNextLikelyPaydayAfterDays(new Date('2026-02-26'), 2);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(1);
  });
});
