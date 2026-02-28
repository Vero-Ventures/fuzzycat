import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { PLATFORM_RESERVE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';

// ── Mocks ────────────────────────────────────────────────────────────

const mockInsertValues = mock();
const mockInsert = mock();
const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelect = mock();

mock.module('@/server/db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
  },
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// NOTE: We do NOT mock @/server/services/audit here. The real logAuditEvent
// runs against the mocked db, so audit inserts go through mockInsertValues.
// This avoids poisoning the audit module mock for audit.test.ts (Bun's
// mock.module is global across test files in the same process).

const { calculateContribution, contributeToReserve, getRiskPoolBalance, getRiskPoolHealth } =
  await import('@/server/services/guarantee');

// ── Setup / teardown ─────────────────────────────────────────────────

beforeEach(() => {
  mockInsertValues.mockResolvedValue([]);
  mockInsert.mockReturnValue({ values: mockInsertValues });

  mockSelectWhere.mockResolvedValue([]);
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
});

afterEach(() => {
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockSelect.mockClear();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
});

// ── calculateContribution tests ──────────────────────────────────────

describe('calculateContribution', () => {
  it('calculates 1% of total with fee', () => {
    // $1,200 bill + 6% fee = $1,272.00 = 127,200 cents
    // 1% of 127,200 = 1,272 cents
    const totalWithFeeCents = 127_200;
    const result = calculateContribution(totalWithFeeCents);
    expect(result).toBe(percentOfCents(totalWithFeeCents, PLATFORM_RESERVE_RATE));
    expect(result).toBe(1272);
  });

  it('calculates contribution for minimum bill ($500)', () => {
    // $500 + 6% = $530 = 53,000 cents
    // 1% = 530 cents
    const totalWithFeeCents = 53_000;
    const result = calculateContribution(totalWithFeeCents);
    expect(result).toBe(530);
  });

  it('returns 0 for 0 cents', () => {
    expect(calculateContribution(0)).toBe(0);
  });

  it('rounds to nearest cent', () => {
    // 1% of 77,777 = 777.77 → rounds to 778
    expect(calculateContribution(77_777)).toBe(778);
  });
});

// ── contributeToReserve tests ────────────────────────────────────────

describe('contributeToReserve', () => {
  it('inserts a contribution entry into the risk pool table', async () => {
    await contributeToReserve('plan-1', 1272);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith({
      planId: 'plan-1',
      contributionCents: 1272,
      type: 'contribution',
    });
  });

  it('logs an audit event for the contribution', async () => {
    // Pass the mock db as a tx so both the risk-pool insert and the audit
    // insert go through the same mockInsert → mockInsertValues chain.
    // Without this, Bun's global mock.module contamination can cause
    // logAuditEvent's db import to resolve to a different test's mock.
    const fakeTx = { insert: mockInsert } as never;
    await contributeToReserve('plan-1', 1272, fakeTx);

    const auditCall = mockInsertValues.mock.calls[1]?.[0] as Record<string, unknown> | undefined;
    expect(auditCall).toBeDefined();
    expect(auditCall?.entityType).toBe('risk_pool');
    expect(auditCall?.entityId).toBe('plan-1');
    expect(auditCall?.action).toBe('contributed');
    expect(auditCall?.actorType).toBe('system');
  });

  it('throws for zero contribution', async () => {
    await expect(contributeToReserve('plan-1', 0)).rejects.toThrow(RangeError);
  });

  it('throws for negative contribution', async () => {
    await expect(contributeToReserve('plan-1', -100)).rejects.toThrow(RangeError);
  });

  it('uses the transaction executor when tx is provided', async () => {
    const txInsertValues = mock().mockResolvedValue([]);
    const txInsert = mock().mockReturnValue({ values: txInsertValues });
    const fakeTx = { insert: txInsert };

    await contributeToReserve('plan-1', 1272, fakeTx as never);

    // Both the risk pool insert and the audit log insert go through txInsert
    expect(txInsert).toHaveBeenCalled();
    // db.insert should not be called (tx is used instead)
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ── getRiskPoolBalance tests ─────────────────────────────────────────

describe('getRiskPoolBalance', () => {
  it('returns balance breakdown from aggregated SQL result', async () => {
    mockSelectFrom.mockResolvedValue([
      {
        totalContributionsCents: 50_000,
        totalClaimsCents: 10_000,
        totalRecoveriesCents: 2_000,
      },
    ]);

    const result = await getRiskPoolBalance();

    expect(result).toEqual({
      totalContributionsCents: 50_000,
      totalClaimsCents: 10_000,
      totalRecoveriesCents: 2_000,
      balanceCents: 42_000, // 50000 + 2000 - 10000
    });
  });

  it('handles string values from SQL driver (coerces to number)', async () => {
    mockSelectFrom.mockResolvedValue([
      {
        totalContributionsCents: '50000',
        totalClaimsCents: '10000',
        totalRecoveriesCents: '2000',
      },
    ]);

    const result = await getRiskPoolBalance();

    expect(result.totalContributionsCents).toBe(50_000);
    expect(result.balanceCents).toBe(42_000);
  });

  it('returns zero balance when no entries exist', async () => {
    mockSelectFrom.mockResolvedValue([]);

    const result = await getRiskPoolBalance();

    expect(result).toEqual({
      totalContributionsCents: 0,
      totalClaimsCents: 0,
      totalRecoveriesCents: 0,
      balanceCents: 0,
    });
  });
});

// ── getRiskPoolHealth tests ──────────────────────────────────────────

describe('getRiskPoolHealth', () => {
  it('returns health metrics with coverage ratio', async () => {
    // First call: getRiskPoolBalance (via db.select().from(riskPool))
    // Second call: outstanding (via db.select().from(plans).where(...))
    let callCount = 0;
    mockSelectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Reserve balance query
        return Promise.resolve([
          {
            totalContributionsCents: 100_000,
            totalClaimsCents: 20_000,
            totalRecoveriesCents: 5_000,
          },
        ]);
      }
      // Outstanding exposure query
      return { where: mockSelectWhere };
    });
    mockSelectWhere.mockResolvedValue([
      {
        outstandingCents: 500_000,
        activePlanCount: 10,
      },
    ]);

    const result = await getRiskPoolHealth();

    expect(result.balanceCents).toBe(85_000); // 100000 + 5000 - 20000
    expect(result.outstandingGuaranteesCents).toBe(500_000);
    expect(result.activePlanCount).toBe(10);
    expect(result.coverageRatio).toBeCloseTo(0.17, 2); // 85000 / 500000
  });

  it('returns zero coverage ratio when no active plans', async () => {
    let callCount = 0;
    mockSelectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([
          {
            totalContributionsCents: 10_000,
            totalClaimsCents: 0,
            totalRecoveriesCents: 0,
          },
        ]);
      }
      return { where: mockSelectWhere };
    });
    mockSelectWhere.mockResolvedValue([
      {
        outstandingCents: 0,
        activePlanCount: 0,
      },
    ]);

    const result = await getRiskPoolHealth();

    expect(result.coverageRatio).toBe(0);
    expect(result.activePlanCount).toBe(0);
  });
});
