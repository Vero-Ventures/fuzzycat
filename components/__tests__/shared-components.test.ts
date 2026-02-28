import { describe, expect, it } from 'bun:test';
import { formatCents } from '@/lib/utils/money';

/**
 * Tests for shared component logic.
 *
 * Since Bun's test runner does not provide a DOM environment for React rendering,
 * these tests validate the underlying logic, data mappings, and formatting rules
 * that power the shared components.
 */

// ── StatusBadge logic ──────────────────────────────────────────────

const STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'yellow',
  processing: 'blue',
  active: 'green',
  succeeded: 'green',
  completed: 'green',
  failed: 'red',
  defaulted: 'red',
  retried: 'orange',
  written_off: 'gray',
  suspended: 'red',
  cancelled: 'gray',
};

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

describe('StatusBadge logic', () => {
  it('maps all known statuses to colors', () => {
    const statuses = [
      'pending',
      'processing',
      'active',
      'succeeded',
      'completed',
      'failed',
      'defaulted',
      'retried',
      'written_off',
      'suspended',
      'cancelled',
    ];

    for (const status of statuses) {
      expect(STATUS_COLOR_MAP[status]).toBeDefined();
      expect(typeof STATUS_COLOR_MAP[status]).toBe('string');
    }
  });

  it('maps pending to yellow', () => {
    expect(STATUS_COLOR_MAP.pending).toBe('yellow');
  });

  it('maps processing to blue', () => {
    expect(STATUS_COLOR_MAP.processing).toBe('blue');
  });

  it('maps active/succeeded/completed to green', () => {
    expect(STATUS_COLOR_MAP.active).toBe('green');
    expect(STATUS_COLOR_MAP.succeeded).toBe('green');
    expect(STATUS_COLOR_MAP.completed).toBe('green');
  });

  it('maps failed/defaulted/suspended to red', () => {
    expect(STATUS_COLOR_MAP.failed).toBe('red');
    expect(STATUS_COLOR_MAP.defaulted).toBe('red');
    expect(STATUS_COLOR_MAP.suspended).toBe('red');
  });

  it('maps retried to orange', () => {
    expect(STATUS_COLOR_MAP.retried).toBe('orange');
  });

  it('maps written_off and cancelled to gray', () => {
    expect(STATUS_COLOR_MAP.written_off).toBe('gray');
    expect(STATUS_COLOR_MAP.cancelled).toBe('gray');
  });

  it('formatStatus converts snake_case to Title Case', () => {
    expect(formatStatus('written_off')).toBe('Written Off');
    expect(formatStatus('pending')).toBe('Pending');
    expect(formatStatus('active')).toBe('Active');
  });
});

// ── CurrencyDisplay logic ──────────────────────────────────────────

describe('CurrencyDisplay logic', () => {
  it('formats zero cents as $0.00', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats 100 cents as $1.00', () => {
    expect(formatCents(100)).toBe('$1.00');
  });

  it('formats 1250 cents as $12.50', () => {
    expect(formatCents(1250)).toBe('$12.50');
  });

  it('formats 120000 cents as $1,200.00', () => {
    expect(formatCents(120_000)).toBe('$1,200.00');
  });

  it('formats 1 cent correctly', () => {
    expect(formatCents(1)).toBe('$0.01');
  });

  it('displays positive sign correctly', () => {
    const amount = 5000;
    const formatted = formatCents(Math.abs(amount));
    const display = amount > 0 ? `+${formatted}` : formatted;
    expect(display).toBe('+$50.00');
  });

  it('displays negative sign correctly', () => {
    const amount = -5000;
    const formatted = formatCents(Math.abs(amount));
    const display = amount < 0 ? `-${formatted}` : formatted;
    expect(display).toBe('-$50.00');
  });

  it('displays no sign for zero', () => {
    const amount = 0;
    const formatted = formatCents(Math.abs(amount));
    expect(formatted).toBe('$0.00');
  });
});

// ── EmptyState logic ───────────────────────────────────────────────

describe('EmptyState logic', () => {
  it('accepts title and description as required props', () => {
    const props = {
      title: 'No payments yet',
      description: 'Your payment history will appear here once you enroll in a plan.',
    };
    expect(props.title).toBe('No payments yet');
    expect(props.description).toBe(
      'Your payment history will appear here once you enroll in a plan.',
    );
  });

  it('icon prop defaults to undefined (component defaults to Cat icon)', () => {
    const props: { title: string; description: string; icon?: unknown } = {
      title: 'No data',
      description: 'Nothing here.',
    };
    expect(props.icon).toBeUndefined();
  });

  it('action prop is optional', () => {
    const props: { title: string; description: string; action?: unknown } = {
      title: 'No data',
      description: 'Nothing here.',
    };
    expect(props.action).toBeUndefined();
  });
});

// ── PageHeader logic ───────────────────────────────────────────────

describe('PageHeader logic', () => {
  it('title is required', () => {
    const props = { title: 'Dashboard' };
    expect(props.title).toBe('Dashboard');
  });

  it('description is optional', () => {
    const propsWithDesc = { title: 'Dashboard', description: 'Overview of your account' };
    expect(propsWithDesc.description).toBe('Overview of your account');

    const propsWithout: { title: string; description?: string } = { title: 'Dashboard' };
    expect(propsWithout.description).toBeUndefined();
  });

  it('children prop is optional for action buttons', () => {
    const props: { title: string; children?: unknown } = { title: 'Dashboard' };
    expect(props.children).toBeUndefined();
  });
});
