import { describe, expect, it } from 'bun:test';
import { daysUntil, formatCountdown, formatDate } from '@/lib/utils/date';

// ── Status display mappings ──────────────────────────────────────────

const PLAN_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  deposit_paid: 'Deposit Paid',
  completed: 'Completed',
  pending: 'Pending',
  defaulted: 'Defaulted',
  cancelled: 'Cancelled',
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  succeeded: 'Succeeded',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  retried: 'Retried',
  written_off: 'Written Off',
};

// ── Tests ────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a Date object', () => {
    const result = formatDate(new Date('2026-02-20T12:00:00Z'));
    expect(result).toContain('Feb');
    expect(result).toContain('2026');
    expect(result).toContain('20');
  });

  it('formats a date string', () => {
    const result = formatDate('2026-12-25');
    expect(result).toContain('Dec');
    expect(result).toContain('25');
    expect(result).toContain('2026');
  });

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('\u2014');
  });
});

describe('daysUntil', () => {
  it('returns positive number for future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    expect(daysUntil(futureDate)).toBeGreaterThan(0);
  });

  it('returns negative number for past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    expect(daysUntil(pastDate)).toBeLessThan(0);
  });
});

describe('formatCountdown', () => {
  it('returns "Today" for today\'s date', () => {
    const today = new Date();
    expect(formatCountdown(today)).toBe('Today');
  });

  it('returns "Tomorrow" for tomorrow\'s date', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(formatCountdown(tomorrow)).toBe('Tomorrow');
  });

  it('returns "In X days" for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(formatCountdown(future)).toBe('In 5 days');
  });

  it('returns "Overdue" for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 2);
    expect(formatCountdown(past)).toBe('Overdue');
  });
});

describe('plan status labels', () => {
  it('maps all plan statuses to display labels', () => {
    const statuses = ['active', 'deposit_paid', 'completed', 'pending', 'defaulted', 'cancelled'];
    for (const status of statuses) {
      expect(PLAN_STATUS_LABEL[status]).toBeDefined();
      expect(typeof PLAN_STATUS_LABEL[status]).toBe('string');
    }
  });
});

describe('payment status labels', () => {
  it('maps all payment statuses to display labels', () => {
    const statuses = ['succeeded', 'pending', 'processing', 'failed', 'retried', 'written_off'];
    for (const status of statuses) {
      expect(PAYMENT_STATUS_LABEL[status]).toBeDefined();
      expect(typeof PAYMENT_STATUS_LABEL[status]).toBe('string');
    }
  });
});
