import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { logger } from '@/lib/logger';

// ── Mocks ────────────────────────────────────────────────────────────

import { createMockChain, dbMock, mockInsert, mockInsertValues, resetDbMocks } from './db-mock';

mock.module('@/server/db', () => ({
  db: dbMock,
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

const { logAuditEvent, getAuditLogByEntity, getAuditLogByType } = await import(
  '@/server/services/audit'
);

// ── Setup / teardown ─────────────────────────────────────────────────

beforeEach(resetDbMocks);
afterEach(resetDbMocks);

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
        oldValue: { status: 'pending' },
        newValue: { status: 'processing' },
        actorType: 'system',
      }),
    );
  });

  it('does not throw when db insert fails', async () => {
    mockInsertValues.mockRejectedValue(new Error('DB connection failed'));
    const logSpy = spyOn(logger, 'error');

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
