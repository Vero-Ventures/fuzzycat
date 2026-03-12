import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { FOUNDING_CLINIC_LIMIT, FOUNDING_CLINIC_SHARE_BPS } from '@/lib/constants';

// ── Mocks ────────────────────────────────────────────────────────────

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// Feature flag mock — default to enabled so existing tests pass
const mockServerEnv = mock(() => ({ ENABLE_FOUNDING_CLINIC: 'true' }) as Record<string, string>);
mock.module('@/lib/env', () => ({
  serverEnv: mockServerEnv,
  _resetEnvCache: () => {},
}));

// DB mock chain (for non-transaction queries)
const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelect = mock();

// Transaction mocks
const mockTxSelectLimit = mock();
const mockTxSelectWhere = mock();
const mockTxSelectFrom = mock();
const mockTxSelect = mock();
const mockTxUpdateWhere = mock();
const mockTxUpdateSet = mock();
const mockTxUpdate = mock();

// The transaction mock passes the tx object to the callback without
// overwriting mock implementations — each test wires up mockTxSelect*
// before calling the function under test.
const mockTransaction = mock(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
  const tx = {
    select: mockTxSelect,
    update: mockTxUpdate,
  };
  return fn(tx);
});

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mock(),
    insert: mock(),
    transaction: mockTransaction,
  },
}));

import { schemaMock } from '../stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// ── Import under test AFTER mocks ───────────────────────────────────

const {
  getFoundingClinicCount,
  isFoundingClinicAvailable,
  getFoundingClinicStatus,
  enrollAsFoundingClinic,
} = await import('@/server/services/founding-clinic');

// ── Helpers ──────────────────────────────────────────────────────────

function wireDbSelectChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function wireTxChain() {
  mockTxSelectLimit.mockReturnValue([]);
  mockTxSelectWhere.mockReturnValue({ limit: mockTxSelectLimit });
  mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
  mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

  mockTxUpdateWhere.mockResolvedValue([]);
  mockTxUpdateSet.mockReturnValue({ where: mockTxUpdateWhere });
  mockTxUpdate.mockReturnValue({ set: mockTxUpdateSet });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('founding-clinic service', () => {
  beforeEach(() => {
    // Clear call counts without resetting implementations
    mockSelectLimit.mockClear();
    mockSelectWhere.mockClear();
    mockSelectFrom.mockClear();
    mockSelect.mockClear();
    mockTxSelectLimit.mockClear();
    mockTxSelectWhere.mockClear();
    mockTxSelectFrom.mockClear();
    mockTxSelect.mockClear();
    mockTxUpdateWhere.mockClear();
    mockTxUpdateSet.mockClear();
    mockTxUpdate.mockClear();
    mockTransaction.mockClear();

    wireDbSelectChain();
    wireTxChain();
  });

  // ── getFoundingClinicCount ──────────────────────────────────────

  describe('getFoundingClinicCount', () => {
    it('returns the count from the DB', async () => {
      mockSelectWhere.mockReturnValue([{ count: 12 }]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const count = await getFoundingClinicCount();
      expect(count).toBe(12);
    });

    it('returns 0 when result is empty', async () => {
      mockSelectWhere.mockReturnValue([{}]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const count = await getFoundingClinicCount();
      expect(count).toBe(0);
    });
  });

  // ── isFoundingClinicAvailable ───────────────────────────────────

  describe('isFoundingClinicAvailable', () => {
    it('returns true when count is below limit', async () => {
      mockSelectWhere.mockReturnValue([{ count: FOUNDING_CLINIC_LIMIT - 1 }]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const available = await isFoundingClinicAvailable();
      expect(available).toBe(true);
    });

    it('returns false when count equals limit', async () => {
      mockSelectWhere.mockReturnValue([{ count: FOUNDING_CLINIC_LIMIT }]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const available = await isFoundingClinicAvailable();
      expect(available).toBe(false);
    });

    it('returns false when count exceeds limit', async () => {
      mockSelectWhere.mockReturnValue([{ count: FOUNDING_CLINIC_LIMIT + 5 }]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const available = await isFoundingClinicAvailable();
      expect(available).toBe(false);
    });
  });

  // ── getFoundingClinicStatus ─────────────────────────────────────

  describe('getFoundingClinicStatus', () => {
    it('returns status for a founding clinic', async () => {
      const expiresAt = new Date('2027-01-01');
      let callCount = 0;
      mockSelectWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { limit: () => [{ foundingClinic: true, foundingExpiresAt: expiresAt }] };
        }
        return [{ count: 10 }];
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const status = await getFoundingClinicStatus('clinic-1');
      expect(status.enabled).toBe(true);
      expect(status.isFoundingClinic).toBe(true);
      expect(status.expiresAt).toEqual(expiresAt);
      expect(status.spotsRemaining).toBe(FOUNDING_CLINIC_LIMIT - 10);
    });

    it('returns non-founding status for unknown clinic', async () => {
      let callCount = 0;
      mockSelectWhere.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { limit: () => [] };
        }
        return [{ count: 5 }];
      });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const status = await getFoundingClinicStatus('clinic-unknown');
      expect(status.enabled).toBe(true);
      expect(status.isFoundingClinic).toBe(false);
      expect(status.expiresAt).toBeNull();
      expect(status.spotsRemaining).toBe(FOUNDING_CLINIC_LIMIT - 5);
    });

    it('returns disabled status when feature flag is off', async () => {
      mockServerEnv.mockReturnValue({ ENABLE_FOUNDING_CLINIC: '' });

      const status = await getFoundingClinicStatus('clinic-1');
      expect(status.enabled).toBe(false);
      expect(status.isFoundingClinic).toBe(false);
      expect(status.expiresAt).toBeNull();
      expect(status.spotsRemaining).toBe(0);
      // Should not have queried the DB at all
      expect(mockSelect).not.toHaveBeenCalled();
      // Restore default
      mockServerEnv.mockReturnValue({ ENABLE_FOUNDING_CLINIC: 'true' });
    });

    it('hides founding status when disabled even if clinic was enrolled', async () => {
      mockServerEnv.mockReturnValue({ ENABLE_FOUNDING_CLINIC: '' });

      const status = await getFoundingClinicStatus('clinic-1');
      expect(status.enabled).toBe(false);
      expect(status.isFoundingClinic).toBe(false);
      expect(status.expiresAt).toBeNull();
      expect(status.spotsRemaining).toBe(0);
      // Restore default
      mockServerEnv.mockReturnValue({ ENABLE_FOUNDING_CLINIC: 'true' });
    });
  });

  // ── enrollAsFoundingClinic ──────────────────────────────────────

  describe('enrollAsFoundingClinic', () => {
    it('succeeds when clinic exists, not already founding, and spots available', async () => {
      let txSelectCallCount = 0;
      mockTxSelectWhere.mockImplementation(() => {
        txSelectCallCount++;
        if (txSelectCallCount === 1) {
          return { limit: () => [{ foundingClinic: false }] };
        }
        return [{ count: 10 }];
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await enrollAsFoundingClinic('clinic-1');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('fails when clinic is not found', async () => {
      mockTxSelectWhere.mockReturnValue({ limit: () => [] });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await enrollAsFoundingClinic('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Clinic not found');
    });

    it('fails when clinic is already enrolled', async () => {
      mockTxSelectWhere.mockReturnValue({
        limit: () => [{ foundingClinic: true }],
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await enrollAsFoundingClinic('clinic-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Already enrolled as a Founding Clinic');
    });

    it('fails when founding clinic limit is reached', async () => {
      let txSelectCallCount = 0;
      mockTxSelectWhere.mockImplementation(() => {
        txSelectCallCount++;
        if (txSelectCallCount === 1) {
          return { limit: () => [{ foundingClinic: false }] };
        }
        return [{ count: FOUNDING_CLINIC_LIMIT }];
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await enrollAsFoundingClinic('clinic-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Founding Clinic program is full');
    });

    it('rejects enrollment when feature flag is off', async () => {
      mockServerEnv.mockReturnValue({ ENABLE_FOUNDING_CLINIC: '' });

      const result = await enrollAsFoundingClinic('clinic-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Founding Clinic program is not currently available');
      expect(mockTransaction).not.toHaveBeenCalled();
      // Restore default
      mockServerEnv.mockReturnValue({ ENABLE_FOUNDING_CLINIC: 'true' });
    });

    it('updates clinic with founding status on success', async () => {
      let txSelectCallCount = 0;
      mockTxSelectWhere.mockImplementation(() => {
        txSelectCallCount++;
        if (txSelectCallCount === 1) {
          return { limit: () => [{ foundingClinic: false }] };
        }
        return [{ count: 0 }];
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      await enrollAsFoundingClinic('clinic-1');

      expect(mockTxUpdate).toHaveBeenCalled();
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          foundingClinic: true,
          revenueShareBps: FOUNDING_CLINIC_SHARE_BPS,
        }),
      );
    });
  });
});
