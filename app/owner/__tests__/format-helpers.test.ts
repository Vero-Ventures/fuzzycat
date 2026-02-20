import { describe, expect, it } from 'bun:test';

// ── Date formatting helper (same logic as in components) ─────────────

function formatDate(date: Date | string | null): string {
  if (!date) return '--';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

function daysUntil(date: Date | string): number {
  const target = new Date(date);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatCountdown(daysLeft: number): string {
  if (daysLeft < 0) return 'Overdue';
  if (daysLeft === 0) return 'Today';
  if (daysLeft === 1) return 'Tomorrow';
  return `in ${daysLeft} days`;
}

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

  it('returns -- for null', () => {
    expect(formatDate(null)).toBe('--');
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
  it('returns "Today" for 0 days', () => {
    expect(formatCountdown(0)).toBe('Today');
  });

  it('returns "Tomorrow" for 1 day', () => {
    expect(formatCountdown(1)).toBe('Tomorrow');
  });

  it('returns "in X days" for multiple days', () => {
    expect(formatCountdown(5)).toBe('in 5 days');
  });

  it('returns "Overdue" for negative days', () => {
    expect(formatCountdown(-2)).toBe('Overdue');
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
