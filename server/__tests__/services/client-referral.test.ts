import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { CLIENT_REFERRAL_CREDIT_CENTS, CLIENT_REFERRAL_DISCOUNT_CENTS } from '@/lib/constants';

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
    insert: mockInsert,
    transaction: mockTransaction,
  },
}));

import { schemaMock } from '../stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// ── Import under test AFTER mocks ───────────────────────────────────

const {
  generateClientReferralCode,
  getOrCreateClientReferralCode,
  getClientReferrals,
  convertClientReferral,
  getReferralDiscount,
} = await import('@/server/services/client-referral');

// ── Helpers ──────────────────────────────────────────────────────────

function wireDbChain() {
  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });

  mockInsertValues.mockResolvedValue([]);
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

describe('client-referral service', () => {
  beforeEach(() => {
    clearAllMocks();
    wireDbChain();
    wireTxChain();
  });

  // ── generateClientReferralCode (pure / crypto) ───────────────────

  describe('generateClientReferralCode', () => {
    it('produces FC-CLIENT-<6-hex> format', () => {
      const code = generateClientReferralCode();
      expect(code).toMatch(/^FC-CLIENT-[A-F0-9]{6}$/);
    });

    it('generates unique codes across calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateClientReferralCode());
      }
      // With 6 hex chars (16M possibilities), 20 calls should all be unique
      expect(codes.size).toBe(20);
    });

    it('always starts with FC-CLIENT-', () => {
      for (let i = 0; i < 10; i++) {
        expect(generateClientReferralCode()).toStartWith('FC-CLIENT-');
      }
    });
  });

  // ── getOrCreateClientReferralCode ────────────────────────────────

  describe('getOrCreateClientReferralCode', () => {
    it('returns existing code when owner already has one', async () => {
      mockSelectLimit.mockReturnValue([{ referralCode: 'FC-CLIENT-AABBCC' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getOrCreateClientReferralCode('owner-1');
      expect(result.code).toBe('FC-CLIENT-AABBCC');
      expect(result.shareUrl).toContain('FC-CLIENT-AABBCC');
      expect(result.discountAmount).toBe(CLIENT_REFERRAL_DISCOUNT_CENTS);
      expect(result.creditAmount).toBe(CLIENT_REFERRAL_CREDIT_CENTS);
    });

    it('creates a new code when owner has none', async () => {
      mockSelectLimit.mockReturnValue([]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getOrCreateClientReferralCode('owner-2');
      expect(result.code).toMatch(/^FC-CLIENT-[A-F0-9]{6}$/);
      expect(result.shareUrl).toStartWith('https://www.fuzzycatapp.com/signup/client?ref=');
      expect(result.discountAmount).toBe(CLIENT_REFERRAL_DISCOUNT_CENTS);
      expect(result.creditAmount).toBe(CLIENT_REFERRAL_CREDIT_CENTS);
      // Should have called insert
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // ── getClientReferrals ───────────────────────────────────────────

  describe('getClientReferrals', () => {
    it('returns referral rows ordered by createdAt', async () => {
      const rows = [
        {
          id: 'or-1',
          referralCode: 'FC-CLIENT-111111',
          status: 'pending' as const,
          creditApplied: false,
          convertedAt: null,
          createdAt: new Date(),
        },
      ];
      mockSelectOrderBy.mockReturnValue(rows);
      mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getClientReferrals('owner-1');
      expect(result).toHaveLength(1);
      expect(result[0].referralCode).toBe('FC-CLIENT-111111');
    });
  });

  // ── convertClientReferral ────────────────────────────────────────

  describe('convertClientReferral', () => {
    it('returns success with referrerId when pending referral exists', async () => {
      mockTxSelectWhere.mockReturnValue({
        limit: () => [{ id: 'or-1', referrerClientId: 'owner-referrer', status: 'pending' }],
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertClientReferral('FC-CLIENT-123456', 'owner-referred');
      expect(result.success).toBe(true);
      expect(result.referrerId).toBe('owner-referrer');
    });

    it('updates referral status to converted', async () => {
      mockTxSelectWhere.mockReturnValue({
        limit: () => [{ id: 'or-1', referrerClientId: 'owner-referrer', status: 'pending' }],
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      await convertClientReferral('FC-CLIENT-123456', 'owner-referred');

      expect(mockTxUpdate).toHaveBeenCalled();
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          referredClientId: 'owner-referred',
          status: 'converted',
        }),
      );
    });

    it('returns failure when no pending referral found', async () => {
      mockTxSelectWhere.mockReturnValue({ limit: () => [] });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertClientReferral('FC-INVALID-000000', 'owner-referred');
      expect(result.success).toBe(false);
      expect(result.referrerId).toBeUndefined();
    });
  });

  // ── getReferralDiscount ─────────────────────────────────────────

  describe('getReferralDiscount', () => {
    it('returns discount cents when owner was referred', async () => {
      mockSelectLimit.mockReturnValue([{ id: 'or-1' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const discount = await getReferralDiscount('owner-referred');
      expect(discount).toBe(CLIENT_REFERRAL_DISCOUNT_CENTS);
    });

    it('returns 0 when owner was not referred', async () => {
      mockSelectLimit.mockReturnValue([]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const discount = await getReferralDiscount('owner-no-referral');
      expect(discount).toBe(0);
    });

    it('returns discount amount equal to CLIENT_REFERRAL_DISCOUNT_CENTS constant', async () => {
      mockSelectLimit.mockReturnValue([{ id: 'some-referral' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const discount = await getReferralDiscount('owner-1');
      expect(discount).toBe(2_000); // $20 in cents
    });
  });
});
