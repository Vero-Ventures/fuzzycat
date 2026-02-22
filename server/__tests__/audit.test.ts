import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockLoggerError = mock();

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mockLoggerError,
  },
}));

import { createMockChain, dbMock, resetDbMocks } from './db-mock';

mock.module('@/server/db', () => ({
  db: dbMock,
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

const { logAuditEvent, getAuditLogByEntity, getAuditLogByType } = await import(
  '@/server/services/audit'
);

// ── Setup / teardown ─────────────────────────────────────────────────

beforeEach(() => {
  resetDbMocks();
  mockLoggerError.mockClear();
});
afterEach(() => {
  resetDbMocks();
  mockLoggerError.mockClear();
});

// ── logAuditEvent tests ──────────────────────────────────────────────

describe('logAuditEvent', () => {
  it('inserts audit log entry with all required fields', async () => {
    // Use an explicit tx mock to avoid cross-test db mock contamination.
    const txInsertValues = mock(() => Promise.resolve([]));
    const txInsert = mock(() => ({ values: txInsertValues }));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const tx = { insert: txInsert } as any;

    await logAuditEvent(
      {
        entityType: 'payment',
        entityId: 'pay-123',
        action: 'status_changed',
        oldValue: { status: 'pending' },
        newValue: { status: 'processing' },
        actorType: 'system',
      },
      tx,
    );

    expect(txInsert).toHaveBeenCalled();
    expect(txInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-123',
        action: 'status_changed',
        oldValue: { status: 'pending' },
        newValue: { status: 'processing' },
        actorType: 'system',
      }),
    );
  });

  it('does not throw when db insert fails', async () => {
    // Use an explicit tx mock that throws to test error handling,
    // avoiding cross-test db mock contamination.
    const txInsertValues = mock(() => {
      throw new Error('DB connection failed');
    });
    const txInsert = mock(() => ({ values: txInsertValues }));
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const tx = { insert: txInsert } as any;

    // The primary guarantee: logAuditEvent never throws, even on failure.
    // This is a compliance requirement — audit failures must not break
    // business logic.
    await expect(
      logAuditEvent(
        {
          entityType: 'payment',
          entityId: 'pay-1',
          action: 'status_changed',
          actorType: 'system',
        },
        tx,
      ),
    ).resolves.toBeUndefined();
  });
});

describe('getAuditLogByEntity', () => {
  it('queries audit log filtered by entityType and entityId', async () => {
    const mockEntry = { id: '1' };
    createMockChain([[mockEntry]]);

    const result = await getAuditLogByEntity('payment', 'pay-1');
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    expect(result).toEqual([mockEntry] as any);
  });
});

describe('getAuditLogByType', () => {
  it('queries audit log filtered by entityType with default pagination', async () => {
    const mockEntry = { id: '1' };
    createMockChain([[mockEntry]]);

    const result = await getAuditLogByType('payment');
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    expect(result).toEqual([mockEntry] as any);
  });
});
