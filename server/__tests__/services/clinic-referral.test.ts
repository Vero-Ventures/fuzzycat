import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { CLINIC_REFERRAL_BONUS_BPS } from '@/lib/constants';

// ── Mocks ────────────────────────────────────────────────────────────

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

// DB mock chain
const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelect = mock();
const mockUpdateWhere = mock();
const mockUpdateSet = mock();
const mockUpdate = mock();
const mockInsertReturning = mock();
const mockInsertValues = mock();
const mockInsert = mock();
const mockSelectOrderBy = mock();

// Transaction mocks
const mockTxSelectLimit = mock();
const mockTxSelectWhere = mock();
const mockTxSelectFrom = mock();
const mockTxSelect = mock();
const mockTxUpdateWhere = mock();
const mockTxUpdateSet = mock();
const mockTxUpdate = mock();

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
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
  },
}));

import { schemaMock } from '../stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// ── Import under test AFTER mocks ───────────────────────────────────

const {
  generateClinicReferralCode,
  getClinicReferralCode,
  getClinicReferrals,
  createClinicReferral,
  convertClinicReferral,
} = await import('@/server/services/clinic-referral');

// ── Helpers ──────────────────────────────────────────────────────────

function wireDbChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });

  mockUpdateWhere.mockResolvedValue([]);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });

  mockInsertReturning.mockResolvedValue([{ id: 'ref-1' }]);
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  mockInsert.mockReturnValue({ values: mockInsertValues });

  mockSelectOrderBy.mockReturnValue([]);
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

function clearAllMocks() {
  for (const m of [
    mockSelectLimit,
    mockSelectWhere,
    mockSelectFrom,
    mockSelect,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockInsertReturning,
    mockInsertValues,
    mockInsert,
    mockSelectOrderBy,
    mockTxSelectLimit,
    mockTxSelectWhere,
    mockTxSelectFrom,
    mockTxSelect,
    mockTxUpdateWhere,
    mockTxUpdateSet,
    mockTxUpdate,
    mockTransaction,
  ]) {
    m.mockClear();
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('clinic-referral service', () => {
  beforeEach(() => {
    clearAllMocks();
    wireDbChain();
    wireTxChain();
  });

  // ── generateClinicReferralCode (pure function) ──────────────────

  describe('generateClinicReferralCode', () => {
    it('produces FC-<NAME>-<HEX> format', () => {
      const code = generateClinicReferralCode('Happy Paws Vet');
      expect(code).toMatch(/^FC-[A-Z0-9]{1,10}-[A-F0-9]{4}$/);
    });

    it('uppercases and strips non-alphanumeric chars', () => {
      const code = generateClinicReferralCode("Dr. Smith's Clinic!");
      // "Dr. Smith's Clinic!" → "DRSMITHSCLINIC" → truncated to 10 → "DRSMITHSCL"
      expect(code).toStartWith('FC-DRSMITHSCL');
    });

    it('truncates long names to 10 characters', () => {
      const code = generateClinicReferralCode('A Very Long Veterinary Clinic Name');
      const parts = code.split('-');
      // FC-<name>-<hex>: the name part should be at most 10 chars
      expect(parts[1].length).toBeLessThanOrEqual(10);
    });

    it('uses fallback "CLINIC" when name sanitizes to empty', () => {
      const code = generateClinicReferralCode('---!!!---');
      expect(code).toMatch(/^FC-CLINIC-[A-F0-9]{4}$/);
    });

    it('generates unique codes across calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateClinicReferralCode('TestClinic'));
      }
      // With 4 hex chars (65536 possibilities), 20 calls should all be unique
      expect(codes.size).toBe(20);
    });
  });

  // ── getClinicReferralCode ───────────────────────────────────────

  describe('getClinicReferralCode', () => {
    it('returns existing referral code when clinic already has one', async () => {
      mockSelectLimit.mockReturnValue([{ referralCode: 'FC-EXIST-ABCD', name: 'Existing Vet' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getClinicReferralCode('clinic-1');
      expect(result.code).toBe('FC-EXIST-ABCD');
      expect(result.shareUrl).toContain('FC-EXIST-ABCD');
      expect(result.shareUrl).toStartWith('https://www.fuzzycatapp.com/signup/clinic?ref=');
    });

    it('generates and stores a new code when clinic has none', async () => {
      mockSelectLimit.mockReturnValue([{ referralCode: null, name: 'New Vet' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getClinicReferralCode('clinic-2');
      expect(result.code).toMatch(/^FC-NEWVET-[A-F0-9]{4}$/);
      expect(result.shareUrl).toContain(result.code);
      // Should have called update to persist the code
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('throws when clinic is not found', async () => {
      mockSelectLimit.mockReturnValue([]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      expect(getClinicReferralCode('nonexistent')).rejects.toThrow('Clinic not found');
    });
  });

  // ── getClinicReferrals ──────────────────────────────────────────

  describe('getClinicReferrals', () => {
    it('returns referral rows ordered by createdAt', async () => {
      const rows = [
        {
          id: 'r1',
          referredEmail: 'a@test.com',
          referralCode: 'FC-X-1111',
          status: 'converted' as const,
          convertedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockSelectOrderBy.mockReturnValue(rows);
      mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getClinicReferrals('clinic-1');
      expect(result).toHaveLength(1);
      expect(result[0].referredEmail).toBe('a@test.com');
    });
  });

  // ── convertClinicReferral ───────────────────────────────────────

  describe('convertClinicReferral', () => {
    it('returns success and applies bonus when pending referral exists', async () => {
      let txSelectCallCount = 0;
      mockTxSelectWhere.mockImplementation(() => {
        txSelectCallCount++;
        if (txSelectCallCount === 1) {
          // Find pending referral
          return {
            limit: () => [{ id: 'ref-1', referrerClinicId: 'clinic-referrer', status: 'pending' }],
          };
        }
        // Lookup referrer clinic's current BPS
        return {
          limit: () => [{ revenueShareBps: 300 }],
        };
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertClinicReferral('FC-CODE-1234', 'clinic-referred');
      expect(result.success).toBe(true);

      // Should update the referral status AND the referrer's BPS
      expect(mockTxUpdate).toHaveBeenCalled();
      // The second .set call should bump BPS by the bonus
      const setCalls = mockTxUpdateSet.mock.calls;
      const bpsUpdate = setCalls.find(
        (call: unknown[]) =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          'revenueShareBps' in (call[0] as Record<string, unknown>),
      );
      expect(bpsUpdate).toBeTruthy();
      expect((bpsUpdate as [Record<string, unknown>])[0].revenueShareBps).toBe(
        300 + CLINIC_REFERRAL_BONUS_BPS,
      );
    });

    it('caps BPS at 1000 (10%)', async () => {
      let txSelectCallCount = 0;
      mockTxSelectWhere.mockImplementation(() => {
        txSelectCallCount++;
        if (txSelectCallCount === 1) {
          return {
            limit: () => [{ id: 'ref-1', referrerClinicId: 'clinic-referrer', status: 'pending' }],
          };
        }
        return {
          limit: () => [{ revenueShareBps: 900 }], // 9% + 2% bonus = 11% → capped at 10%
        };
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      await convertClinicReferral('FC-CODE-1234', 'clinic-referred');

      const setCalls = mockTxUpdateSet.mock.calls;
      const bpsUpdate = setCalls.find(
        (call: unknown[]) =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          'revenueShareBps' in (call[0] as Record<string, unknown>),
      );
      expect(bpsUpdate).toBeTruthy();
      expect((bpsUpdate as [Record<string, unknown>])[0].revenueShareBps).toBe(1000);
    });

    it('returns failure when no pending referral found', async () => {
      mockTxSelectWhere.mockReturnValue({ limit: () => [] });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertClinicReferral('FC-INVALID-0000', 'clinic-referred');
      expect(result.success).toBe(false);
    });

    it('succeeds without applying bonus when referrer clinic not found', async () => {
      let txSelectCallCount = 0;
      mockTxSelectWhere.mockImplementation(() => {
        txSelectCallCount++;
        if (txSelectCallCount === 1) {
          return {
            limit: () => [{ id: 'ref-1', referrerClinicId: 'clinic-gone', status: 'pending' }],
          };
        }
        // Referrer clinic lookup returns empty (clinic deleted or not found)
        return { limit: () => [] };
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertClinicReferral('FC-CODE-1234', 'clinic-referred');
      expect(result.success).toBe(true);

      // Should have updated the referral status but NOT updated BPS
      const setCalls = mockTxUpdateSet.mock.calls;
      const bpsUpdate = setCalls.find(
        (call: unknown[]) =>
          typeof call[0] === 'object' &&
          call[0] !== null &&
          'revenueShareBps' in (call[0] as Record<string, unknown>),
      );
      expect(bpsUpdate).toBeUndefined();
    });
  });

  // ── createClinicReferral ────────────────────────────────────────

  describe('createClinicReferral', () => {
    it('creates a referral and returns id, code, and shareUrl', async () => {
      // Wire getClinicReferralCode to return existing code
      mockSelectLimit.mockReturnValue([{ referralCode: 'FC-TEST-ABCD', name: 'Test Vet' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      mockInsertReturning.mockResolvedValue([{ id: 'ref-new-1' }]);
      mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
      mockInsert.mockReturnValue({ values: mockInsertValues });

      const result = await createClinicReferral('clinic-1', 'newclinic@example.com');
      expect(result.id).toBe('ref-new-1');
      expect(result.referralCode).toBe('FC-TEST-ABCD');
      expect(result.shareUrl).toContain('FC-TEST-ABCD');
      expect(result.shareUrl).toStartWith('https://www.fuzzycatapp.com/signup/clinic?ref=');

      // Verify insert was called with correct values
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith({
        referrerClinicId: 'clinic-1',
        referredEmail: 'newclinic@example.com',
        referralCode: 'FC-TEST-ABCD',
      });
    });

    it('generates a new code if clinic has none, then creates referral', async () => {
      mockSelectLimit.mockReturnValue([{ referralCode: null, name: 'No Code Vet' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      mockInsertReturning.mockResolvedValue([{ id: 'ref-new-2' }]);
      mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
      mockInsert.mockReturnValue({ values: mockInsertValues });

      const result = await createClinicReferral('clinic-2', 'other@example.com');
      expect(result.id).toBe('ref-new-2');
      expect(result.referralCode).toMatch(/^FC-NOCODEVET-[A-F0-9]{4}$/);

      // Should have called update to persist the new code
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
