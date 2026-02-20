import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { RISK_POOL_RATE } from '@/lib/constants';
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

// Mock the audit service to prevent it from making its own db calls
const mockLogAuditEvent = mock().mockResolvedValue(undefined);
mock.module('@/server/services/audit', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

const {
  calculateContribution,
  contributeToRiskPool,
  claimFromRiskPool,
  recordRecovery,
  getRiskPoolBalance,
  getRiskPoolHealth,
} = await import('@/server/services/guarantee');

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
  mockLogAuditEvent.mockClear();
});

// ── calculateContribution tests ──────────────────────────────────────

describe('calculateContribution', () => {
  it('calculates 1% of total with fee', () => {
    // $1,200 bill + 6% fee = $1,272.00 = 127,200 cents
    // 1% of 127,200 = 1,272 cents
    const totalWithFeeCents = 127_200;
    const result = calculateContribution(totalWithFeeCents);
    expect(result).toBe(percentOfCents(totalWithFeeCents, RISK_POOL_RATE));
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

// ── contributeToRiskPool tests ───────────────────────────────────────

describe('contributeToRiskPool', () => {
  it('inserts a contribution entry into the risk pool table', async () => {
    await contributeToRiskPool('plan-1', 1272);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith({
      planId: 'plan-1',
      contributionCents: 1272,
      type: 'contribution',
    });
  });

  it('logs an audit event for the contribution', async () => {
    await contributeToRiskPool('plan-1', 1272);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      {
        entityType: 'risk_pool',
        entityId: 'plan-1',
        action: 'contributed',
        newValue: { type: 'contribution', contributionCents: 1272 },
        actorType: 'system',
      },
      undefined,
    );
  });

  it('throws for zero contribution', async () => {
    await expect(contributeToRiskPool('plan-1', 0)).rejects.toThrow(RangeError);
  });

  it('throws for negative contribution', async () => {
    await expect(contributeToRiskPool('plan-1', -100)).rejects.toThrow(RangeError);
  });

  it('uses the transaction executor when tx is provided', async () => {
    const txInsertValues = mock().mockResolvedValue([]);
    const txInsert = mock().mockReturnValue({ values: txInsertValues });
    const fakeTx = { insert: txInsert };

    await contributeToRiskPool('plan-1', 1272, fakeTx as never);

    expect(txInsert).toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

// ── claimFromRiskPool tests ──────────────────────────────────────────

describe('claimFromRiskPool', () => {
  it('inserts a claim entry into the risk pool table', async () => {
    await claimFromRiskPool('plan-2', 95_400);

    expect(mockInsertValues).toHaveBeenCalledWith({
      planId: 'plan-2',
      contributionCents: 95_400,
      type: 'claim',
    });
  });

  it('logs an audit event for the claim', async () => {
    await claimFromRiskPool('plan-2', 95_400);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      {
        entityType: 'risk_pool',
        entityId: 'plan-2',
        action: 'claimed',
        newValue: { type: 'claim', claimCents: 95_400 },
        actorType: 'system',
      },
      undefined,
    );
  });

  it('throws for zero claim', async () => {
    await expect(claimFromRiskPool('plan-2', 0)).rejects.toThrow(RangeError);
  });

  it('throws for negative claim', async () => {
    await expect(claimFromRiskPool('plan-2', -1)).rejects.toThrow(RangeError);
  });
});

// ── recordRecovery tests ─────────────────────────────────────────────

describe('recordRecovery', () => {
  it('inserts a recovery entry into the risk pool table', async () => {
    await recordRecovery('plan-3', 10_000);

    expect(mockInsertValues).toHaveBeenCalledWith({
      planId: 'plan-3',
      contributionCents: 10_000,
      type: 'recovery',
    });
  });

  it('logs an audit event for the recovery', async () => {
    await recordRecovery('plan-3', 10_000);

    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      {
        entityType: 'risk_pool',
        entityId: 'plan-3',
        action: 'recovered',
        newValue: { type: 'recovery', recoveryCents: 10_000 },
        actorType: 'system',
      },
      undefined,
    );
  });

  it('throws for zero recovery', async () => {
    await expect(recordRecovery('plan-3', 0)).rejects.toThrow(RangeError);
  });

  it('throws for negative recovery', async () => {
    await expect(recordRecovery('plan-3', -500)).rejects.toThrow(RangeError);
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

  it('returns zero balance when no risk pool entries exist', async () => {
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
    // Second call: outstanding guarantees (via db.select().from(plans).where(...))
    let callCount = 0;
    mockSelectFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Risk pool balance query
        return Promise.resolve([
          {
            totalContributionsCents: 100_000,
            totalClaimsCents: 20_000,
            totalRecoveriesCents: 5_000,
          },
        ]);
      }
      // Outstanding guarantees query
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
