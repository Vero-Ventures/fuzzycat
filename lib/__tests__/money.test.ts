import { describe, expect, it } from 'bun:test';
import { addCents, formatCents, percentOfCents, toCents } from '@/lib/utils/money';

describe('toCents', () => {
  it('converts whole dollar amounts', () => {
    expect(toCents(1)).toBe(100);
    expect(toCents(12)).toBe(1200);
    expect(toCents(1200)).toBe(120_000);
  });

  it('converts fractional dollar amounts', () => {
    expect(toCents(12.5)).toBe(1250);
    expect(toCents(9.99)).toBe(999);
    expect(toCents(0.01)).toBe(1);
  });

  it('handles floating-point precision (0.1 + 0.2)', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('converts zero', () => {
    expect(toCents(0)).toBe(0);
  });

  it('handles large values', () => {
    expect(toCents(100_000)).toBe(10_000_000);
  });

  it('throws for negative amounts', () => {
    expect(() => toCents(-1)).toThrow(RangeError);
  });

  it('throws for NaN', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
  });

  it('throws for Infinity', () => {
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('formatCents', () => {
  it('formats standard amounts', () => {
    expect(formatCents(1250)).toBe('$12.50');
    expect(formatCents(100)).toBe('$1.00');
    expect(formatCents(999)).toBe('$9.99');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats large values with comma grouping', () => {
    expect(formatCents(120_000)).toBe('$1,200.00');
    expect(formatCents(1_000_000)).toBe('$10,000.00');
  });

  it('formats negative cents with leading minus sign', () => {
    expect(formatCents(-1)).toBe('-$0.01');
    expect(formatCents(-1500)).toBe('-$15.00');
    expect(formatCents(-120_000)).toBe('-$1,200.00');
  });

  it('throws for NaN', () => {
    expect(() => formatCents(Number.NaN)).toThrow(RangeError);
  });

  it('throws for non-integer cents', () => {
    expect(() => formatCents(12.5)).toThrow(RangeError);
  });
});

describe('addCents', () => {
  it('sums multiple amounts', () => {
    expect(addCents(100, 200, 300)).toBe(600);
  });

  it('returns single value unchanged', () => {
    expect(addCents(500)).toBe(500);
  });

  it('returns 0 for no arguments', () => {
    expect(addCents()).toBe(0);
  });

  it('handles zero values', () => {
    expect(addCents(0, 0, 100)).toBe(100);
  });

  it('handles large sums', () => {
    expect(addCents(1_000_000, 2_000_000, 3_000_000)).toBe(6_000_000);
  });
});

describe('percentOfCents', () => {
  it('calculates 6% of $1,200', () => {
    expect(percentOfCents(120_000, 0.06)).toBe(7200);
  });

  it('calculates 25% of $1,272', () => {
    expect(percentOfCents(127_200, 0.25)).toBe(31_800);
  });

  it('rounds to nearest cent', () => {
    // 3% of $1.00 = 3 cents exactly
    expect(percentOfCents(100, 0.03)).toBe(3);
    // 6% of $7.77 = 46.62 → rounds to 47
    expect(percentOfCents(777, 0.06)).toBe(47);
  });

  it('handles zero cents', () => {
    expect(percentOfCents(0, 0.06)).toBe(0);
  });

  it('handles zero rate', () => {
    expect(percentOfCents(120_000, 0)).toBe(0);
  });

  it('handles 100% rate', () => {
    expect(percentOfCents(120_000, 1)).toBe(120_000);
  });

  it('throws for negative cents', () => {
    expect(() => percentOfCents(-100, 0.06)).toThrow(RangeError);
  });

  it('throws for negative rate', () => {
    expect(() => percentOfCents(100, -0.06)).toThrow(RangeError);
  });

  it('throws for non-finite cents', () => {
    expect(() => percentOfCents(Number.POSITIVE_INFINITY, 0.06)).toThrow(RangeError);
  });
});
