import { beforeEach, describe, expect, it, mock } from 'bun:test';

import { OWNER_REFERRAL_CREDIT_CENTS, OWNER_REFERRAL_DISCOUNT_CENTS } from '@/lib/constants';

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

mock.module('@/server/db/schema', () => ({
  ownerReferrals: {
    id: 'owner_referrals.id',
    referrerOwnerId: 'owner_referrals.referrer_owner_id',
    referredOwnerId: 'owner_referrals.referred_owner_id',
    referralCode: 'owner_referrals.referral_code',
    status: 'owner_referrals.status',
    creditApplied: 'owner_referrals.credit_applied',
    convertedAt: 'owner_referrals.converted_at',
    createdAt: 'owner_referrals.created_at',
  },
}));

// ── Import under test AFTER mocks ───────────────────────────────────

const {
  generateOwnerReferralCode,
  getOrCreateOwnerReferralCode,
  getOwnerReferrals,
  convertOwnerReferral,
  getReferralDiscount,
} = await import('@/server/services/owner-referral');

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

describe('owner-referral service', () => {
  beforeEach(() => {
    clearAllMocks();
    wireDbChain();
    wireTxChain();
  });

  // ── generateOwnerReferralCode (pure / crypto) ───────────────────

  describe('generateOwnerReferralCode', () => {
    it('produces FC-OWNER-<6-hex> format', () => {
      const code = generateOwnerReferralCode();
      expect(code).toMatch(/^FC-OWNER-[A-F0-9]{6}$/);
    });

    it('generates unique codes across calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        codes.add(generateOwnerReferralCode());
      }
      // With 6 hex chars (16M possibilities), 20 calls should all be unique
      expect(codes.size).toBe(20);
    });

    it('always starts with FC-OWNER-', () => {
      for (let i = 0; i < 10; i++) {
        expect(generateOwnerReferralCode()).toStartWith('FC-OWNER-');
      }
    });
  });

  // ── getOrCreateOwnerReferralCode ────────────────────────────────

  describe('getOrCreateOwnerReferralCode', () => {
    it('returns existing code when owner already has one', async () => {
      mockSelectLimit.mockReturnValue([{ referralCode: 'FC-OWNER-AABBCC' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getOrCreateOwnerReferralCode('owner-1');
      expect(result.code).toBe('FC-OWNER-AABBCC');
      expect(result.shareUrl).toContain('FC-OWNER-AABBCC');
      expect(result.discountAmount).toBe(OWNER_REFERRAL_DISCOUNT_CENTS);
      expect(result.creditAmount).toBe(OWNER_REFERRAL_CREDIT_CENTS);
    });

    it('creates a new code when owner has none', async () => {
      mockSelectLimit.mockReturnValue([]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await getOrCreateOwnerReferralCode('owner-2');
      expect(result.code).toMatch(/^FC-OWNER-[A-F0-9]{6}$/);
      expect(result.shareUrl).toStartWith('https://www.fuzzycatapp.com/signup/owner?ref=');
      expect(result.discountAmount).toBe(OWNER_REFERRAL_DISCOUNT_CENTS);
      expect(result.creditAmount).toBe(OWNER_REFERRAL_CREDIT_CENTS);
      // Should have called insert
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  // ── getOwnerReferrals ───────────────────────────────────────────

  describe('getOwnerReferrals', () => {
    it('returns referral rows ordered by createdAt', async () => {
      const rows = [
        {
          id: 'or-1',
          referralCode: 'FC-OWNER-111111',
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

      const result = await getOwnerReferrals('owner-1');
      expect(result).toHaveLength(1);
      expect(result[0].referralCode).toBe('FC-OWNER-111111');
    });
  });

  // ── convertOwnerReferral ────────────────────────────────────────

  describe('convertOwnerReferral', () => {
    it('returns success with referrerId when pending referral exists', async () => {
      mockTxSelectWhere.mockReturnValue({
        limit: () => [{ id: 'or-1', referrerOwnerId: 'owner-referrer', status: 'pending' }],
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertOwnerReferral('FC-OWNER-123456', 'owner-referred');
      expect(result.success).toBe(true);
      expect(result.referrerId).toBe('owner-referrer');
    });

    it('updates referral status to converted', async () => {
      mockTxSelectWhere.mockReturnValue({
        limit: () => [{ id: 'or-1', referrerOwnerId: 'owner-referrer', status: 'pending' }],
      });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      await convertOwnerReferral('FC-OWNER-123456', 'owner-referred');

      expect(mockTxUpdate).toHaveBeenCalled();
      expect(mockTxUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          referredOwnerId: 'owner-referred',
          status: 'converted',
        }),
      );
    });

    it('returns failure when no pending referral found', async () => {
      mockTxSelectWhere.mockReturnValue({ limit: () => [] });
      mockTxSelectFrom.mockReturnValue({ where: mockTxSelectWhere });
      mockTxSelect.mockReturnValue({ from: mockTxSelectFrom });

      const result = await convertOwnerReferral('FC-INVALID-000000', 'owner-referred');
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
      expect(discount).toBe(OWNER_REFERRAL_DISCOUNT_CENTS);
    });

    it('returns 0 when owner was not referred', async () => {
      mockSelectLimit.mockReturnValue([]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const discount = await getReferralDiscount('owner-no-referral');
      expect(discount).toBe(0);
    });

    it('returns discount amount equal to OWNER_REFERRAL_DISCOUNT_CENTS constant', async () => {
      mockSelectLimit.mockReturnValue([{ id: 'some-referral' }]);
      mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const discount = await getReferralDiscount('owner-1');
      expect(discount).toBe(2_000); // $20 in cents
    });
  });
});
