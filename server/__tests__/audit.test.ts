import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { logger } from '@/lib/logger';

// ── Mocks ────────────────────────────────────────────────────────────

const mockInsertValues = mock();
const mockInsert = mock();

const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelectOrderBy = mock();
const mockSelectLimit = mock();
const mockSelectOffset = mock();
const mockSelect = mock();

mock.module('@/server/db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
  },
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// Use a relative path to bypass mock.module('@/server/services/audit', ...)
// registered by guarantee.test.ts. Bun's mock.module is global and keyed by
// specifier string, so importing via a different specifier avoids the conflict
// while still picking up our @/server/db mock (which the audit module imports).
const { logAuditEvent, getAuditLogByEntity, getAuditLogByType } = await import('../services/audit');

// ── Setup / teardown ─────────────────────────────────────────────────

beforeEach(() => {
  mockInsertValues.mockResolvedValue([]);
  mockInsert.mockReturnValue({ values: mockInsertValues });

  mockSelectOffset.mockResolvedValue([]);
  mockSelectLimit.mockReturnValue({ offset: mockSelectOffset });
  mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
  mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
});

afterEach(() => {
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockSelect.mockClear();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectOrderBy.mockClear();
  mockSelectLimit.mockClear();
  mockSelectOffset.mockClear();
});

// ── logAuditEvent tests ──────────────────────────────────────────────

describe('logAuditEvent', () => {
  it('inserts audit log entry with all required fields', async () => {
    await logAuditEvent({
      entityType: 'payment',
      entityId: 'pay-123',
      action: 'status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'processing' },
      actorType: 'system',
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-123',
        action: 'status_changed',
        oldValue: JSON.stringify({ status: 'pending' }),
        newValue: JSON.stringify({ status: 'processing' }),
        actorType: 'system',
      }),
    );
  });

  it('inserts audit log entry with optional actorId and ipAddress', async () => {
    await logAuditEvent({
      entityType: 'plan',
      entityId: 'plan-456',
      action: 'created',
      newValue: { status: 'pending' },
      actorType: 'admin',
      actorId: 'admin-789',
      ipAddress: '192.168.1.1',
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'plan',
        entityId: 'plan-456',
        action: 'created',
        actorType: 'admin',
        actorId: 'admin-789',
        ipAddress: '192.168.1.1',
      }),
    );
  });

  it('serializes oldValue and newValue as JSON strings', async () => {
    await logAuditEvent({
      entityType: 'payment',
      entityId: 'pay-1',
      action: 'status_changed',
      oldValue: { status: 'failed', retryCount: 2 },
      newValue: { status: 'retried', retryCount: 3 },
      actorType: 'system',
    });

    const callArgs = mockInsertValues.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(callArgs[0].oldValue).toBe(JSON.stringify({ status: 'failed', retryCount: 2 }));
    expect(callArgs[0].newValue).toBe(JSON.stringify({ status: 'retried', retryCount: 3 }));
  });

  it('sets oldValue and newValue to null when not provided', async () => {
    await logAuditEvent({
      entityType: 'plan',
      entityId: 'plan-1',
      action: 'created',
      actorType: 'system',
    });

    const callArgs = mockInsertValues.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(callArgs[0].oldValue).toBeNull();
    expect(callArgs[0].newValue).toBeNull();
  });

  it('does not throw when db insert fails', async () => {
    mockInsertValues.mockRejectedValue(new Error('DB connection failed'));
    const logSpy = spyOn(logger, 'error');

    // Should not throw
    await logAuditEvent({
      entityType: 'payment',
      entityId: 'pay-1',
      action: 'status_changed',
      actorType: 'system',
    });

    expect(logSpy).toHaveBeenCalledWith(
      'Failed to write audit log entry',
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-1',
        error: 'DB connection failed',
      }),
    );

    logSpy.mockRestore();
  });

  it('uses the transaction executor when tx is provided', async () => {
    const txInsertValues = mock().mockResolvedValue([]);
    const txInsert = mock().mockReturnValue({ values: txInsertValues });
    const tx = { insert: txInsert } as unknown as Parameters<typeof logAuditEvent>[1];

    await logAuditEvent(
      {
        entityType: 'payout',
        entityId: 'payout-1',
        action: 'created',
        newValue: { status: 'pending' },
        actorType: 'system',
      },
      tx,
    );

    // The tx.insert should have been called, not db.insert
    expect(txInsert).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ── getAuditLogByEntity tests ────────────────────────────────────────

describe('getAuditLogByEntity', () => {
  it('queries audit log filtered by entityType and entityId', async () => {
    const mockEntry = {
      id: '1',
      entityType: 'payment' as const,
      entityId: 'pay-1',
      action: 'status_changed',
      oldValue: { status: 'pending' },
      newValue: { status: 'processing' },
      actorType: 'system' as const,
      actorId: null,
      ipAddress: null,
      createdAt: new Date('2026-01-01'),
    };
    mockSelectOrderBy.mockResolvedValue([mockEntry]);

    const result = await getAuditLogByEntity('payment', 'pay-1');

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual([mockEntry]);
  });

  it('returns empty array when no entries exist', async () => {
    mockSelectOrderBy.mockResolvedValue([]);

    const result = await getAuditLogByEntity('plan', 'plan-nonexistent');

    expect(result).toEqual([]);
  });
});

// ── getAuditLogByType tests ──────────────────────────────────────────

describe('getAuditLogByType', () => {
  it('queries audit log filtered by entityType with default pagination', async () => {
    const mockEntries = [
      {
        id: '1',
        entityType: 'payment' as const,
        entityId: 'pay-1',
        action: 'status_changed',
        oldValue: { status: 'pending' },
        newValue: { status: 'processing' },
        actorType: 'system' as const,
        actorId: null,
        ipAddress: null,
        createdAt: new Date('2026-01-01'),
      },
      {
        id: '2',
        entityType: 'payment' as const,
        entityId: 'pay-2',
        action: 'created',
        oldValue: null,
        newValue: { status: 'pending' },
        actorType: 'system' as const,
        actorId: null,
        ipAddress: null,
        createdAt: new Date('2026-01-02'),
      },
    ];
    mockSelectOffset.mockResolvedValue(mockEntries);

    const result = await getAuditLogByType('payment');

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockEntries);
  });

  it('passes custom limit and offset', async () => {
    mockSelectOffset.mockResolvedValue([]);

    await getAuditLogByType('plan', { limit: 10, offset: 20 });

    expect(mockSelectLimit).toHaveBeenCalledWith(10);
    expect(mockSelectOffset).toHaveBeenCalledWith(20);
  });

  it('returns empty array when no entries exist', async () => {
    mockSelectOffset.mockResolvedValue([]);

    const result = await getAuditLogByType('risk_pool');

    expect(result).toEqual([]);
  });
});
