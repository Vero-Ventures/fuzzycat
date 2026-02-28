import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

// Track all insert/update/select calls made inside the transaction
const mockInsertValues = mock();
const mockInsertReturning = mock();
const mockInsert = mock();

const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelectLimit = mock();
const mockSelect = mock();

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();

// Transaction mock — calls the callback with a mock tx object
const mockTransaction = mock();

// Outer db mocks (for queries that happen outside the transaction)
const mockOuterSelect = mock();
const mockOuterSelectFrom = mock();
const mockOuterSelectWhere = mock();
const mockOuterSelectLimit = mock();

// Mock for db.query.plans.findFirst (used by getEnrollmentSummary)
const mockFindFirst = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockOuterSelect,
    transaction: mockTransaction,
    query: {
      plans: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

import { createAuditMock } from './audit-mock';

mock.module('@/server/services/audit', () => createAuditMock(mockInsert));

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

// Must be imported AFTER mocks are set up
const { createEnrollment, getEnrollmentSummary, cancelEnrollment } = await import(
  '@/server/services/enrollment'
);

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID = '44444444-4444-4444-4444-444444444444';

const VALID_OWNER_DATA = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '555-0100',
  petName: 'Whiskers',
  paymentMethod: 'debit_card' as const,
};

const ENROLLMENT_DATE = new Date('2026-03-01T12:00:00Z');

// ── Types ────────────────────────────────────────────────────────────

interface MockTx {
  select: ReturnType<typeof mock>;
  insert: ReturnType<typeof mock>;
  update: ReturnType<typeof mock>;
}

type TxCallback = (tx: MockTx) => Promise<unknown>;

// ── Helpers ──────────────────────────────────────────────────────────

function setupOuterSelectChain(result: unknown[]) {
  mockOuterSelectLimit.mockResolvedValue(result);
  mockOuterSelectWhere.mockReturnValue({ limit: mockOuterSelectLimit });
  mockOuterSelectFrom.mockReturnValue({ where: mockOuterSelectWhere });
  mockOuterSelect.mockReturnValue({ from: mockOuterSelectFrom });
}

function createMockTx(): MockTx {
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };
}

function clearAllMocks() {
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockInsertReturning.mockClear();
  mockSelect.mockClear();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectLimit.mockClear();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
  mockTransaction.mockClear();
  mockOuterSelect.mockClear();
  mockOuterSelectFrom.mockClear();
  mockOuterSelectWhere.mockClear();
  mockOuterSelectLimit.mockClear();
  mockFindFirst.mockClear();
}

// ── createEnrollment tests ───────────────────────────────────────────

describe('createEnrollment', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it('rejects bills below minimum ($500 = 50000 cents)', async () => {
    await expect(
      createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 49_999, ACTOR_ID, ENROLLMENT_DATE),
    ).rejects.toThrow('below minimum');
  });

  it('rejects when clinic is not found', async () => {
    setupOuterSelectChain([]);

    await expect(
      createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 120_000, ACTOR_ID, ENROLLMENT_DATE),
    ).rejects.toThrow('not found');
  });

  it('rejects when clinic is not active', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'pending' }]);

    await expect(
      createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 120_000, ACTOR_ID, ENROLLMENT_DATE),
    ).rejects.toThrow('not active');
  });

  it('creates enrollment with correct records for a new owner', async () => {
    // Outer select: clinic lookup
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    const paymentIds = [
      { id: 'pay-0' },
      { id: 'pay-1' },
      { id: 'pay-2' },
      { id: 'pay-3' },
      { id: 'pay-4' },
      { id: 'pay-5' },
      { id: 'pay-6' },
    ];

    let insertCallCount = 0;
    const tx = createMockTx();

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      insertCallCount = 0;

      // tx.select() — first call is owner lookup (not found)
      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]), // no existing owner
          }),
        }),
      }));

      // tx.insert() — called multiple times: owner, plan, payments, riskPool, auditLog x2
      mockInsert.mockImplementation(() => {
        insertCallCount++;

        if (insertCallCount === 1) {
          // owner insert
          return {
            values: () => ({
              returning: () => Promise.resolve([{ id: OWNER_ID }]),
            }),
          };
        }
        if (insertCallCount === 2) {
          // plan insert
          return {
            values: () => ({
              returning: () => Promise.resolve([{ id: PLAN_ID }]),
            }),
          };
        }
        if (insertCallCount === 3) {
          // payments insert
          return {
            values: () => ({
              returning: () => Promise.resolve(paymentIds),
            }),
          };
        }
        // risk pool and audit log inserts (no returning needed)
        return {
          values: () => Promise.resolve([]),
        };
      });

      return fn(tx);
    });

    const result = await createEnrollment(
      CLINIC_ID,
      VALID_OWNER_DATA,
      120_000,
      ACTOR_ID,
      ENROLLMENT_DATE,
    );

    expect(result.planId).toBe(PLAN_ID);
    expect(result.ownerId).toBe(OWNER_ID);
    expect(result.paymentIds).toHaveLength(7);
    expect(result.paymentIds).toEqual(paymentIds.map((p) => p.id));
  });

  it('reuses existing owner record when email matches', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    let insertCallCount = 0;
    const tx = createMockTx();

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      insertCallCount = 0;

      mockSelect.mockImplementation(() => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: OWNER_ID }]), // existing owner found
          }),
        }),
      }));

      mockUpdate.mockImplementation(() => ({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      }));

      mockInsert.mockImplementation(() => {
        insertCallCount++;

        if (insertCallCount === 1) {
          // plan insert (no owner insert since owner exists)
          return {
            values: () => ({
              returning: () => Promise.resolve([{ id: PLAN_ID }]),
            }),
          };
        }
        if (insertCallCount === 2) {
          // payments insert
          return {
            values: () => ({
              returning: () =>
                Promise.resolve([
                  { id: 'pay-0' },
                  { id: 'pay-1' },
                  { id: 'pay-2' },
                  { id: 'pay-3' },
                  { id: 'pay-4' },
                  { id: 'pay-5' },
                  { id: 'pay-6' },
                ]),
            }),
          };
        }
        // risk pool and audit logs
        return {
          values: () => Promise.resolve([]),
        };
      });

      return fn(tx);
    });

    const result = await createEnrollment(
      CLINIC_ID,
      VALID_OWNER_DATA,
      120_000,
      ACTOR_ID,
      ENROLLMENT_DATE,
    );

    expect(result.ownerId).toBe(OWNER_ID);
    expect(result.planId).toBe(PLAN_ID);
    expect(result.paymentIds).toHaveLength(7);
  });

  it('wraps all inserts in a database transaction', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    const tx = createMockTx();
    let txCallbackExecuted = false;

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      txCallbackExecuted = true;

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      // Override for non-returning inserts (risk pool, audit log)
      let insertCount = 0;
      mockInsert.mockImplementation(() => {
        insertCount++;
        if (insertCount <= 3) {
          return {
            values: () => ({
              returning: () => Promise.resolve([{ id: `mock-id-${insertCount}` }]),
            }),
          };
        }
        return { values: () => Promise.resolve([]) };
      });

      return fn(tx);
    });

    await createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 120_000, ACTOR_ID, ENROLLMENT_DATE);

    expect(txCallbackExecuted).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('accepts exactly the minimum bill amount', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    const tx = createMockTx();

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      let insertCount = 0;

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      mockInsert.mockImplementation(() => {
        insertCount++;
        if (insertCount <= 3) {
          return {
            values: () => ({
              returning: () => Promise.resolve([{ id: `mock-id-${insertCount}` }]),
            }),
          };
        }
        return { values: () => Promise.resolve([]) };
      });

      return fn(tx);
    });

    // $500 = 50000 cents = minimum
    await expect(
      createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 50_000, ACTOR_ID, ENROLLMENT_DATE),
    ).resolves.toBeDefined();
  });

  it('calculates correct risk pool contribution (1% of total with fee)', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    const tx = createMockTx();
    const insertedValues: unknown[] = [];

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      let insertCount = 0;

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      mockInsert.mockImplementation(() => {
        insertCount++;
        return {
          values: (val: unknown) => {
            insertedValues.push(val);
            if (insertCount <= 3) {
              return {
                returning: () => Promise.resolve([{ id: `mock-id-${insertCount}` }]),
              };
            }
            return Promise.resolve([]);
          },
        };
      });

      return fn(tx);
    });

    await createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 120_000, ACTOR_ID, ENROLLMENT_DATE);

    // $1,200 bill -> 6% fee = $72 -> total = $1,272 -> 1% risk pool = $12.72 = 1272 cents
    // The risk pool insert is the 4th insert (after owner, plan, payments)
    const riskPoolInsert = insertedValues[3] as { contributionCents: number; type: string };
    expect(riskPoolInsert.contributionCents).toBe(1_272);
    expect(riskPoolInsert.type).toBe('contribution');
  });

  it('creates audit log entries for plan creation and risk pool', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    const tx = createMockTx();
    const insertedValues: unknown[] = [];

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      let insertCount = 0;

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      mockInsert.mockImplementation(() => {
        insertCount++;
        return {
          values: (val: unknown) => {
            insertedValues.push(val);
            if (insertCount <= 3) {
              return {
                returning: () => Promise.resolve([{ id: `mock-id-${insertCount}` }]),
              };
            }
            return Promise.resolve([]);
          },
        };
      });

      return fn(tx);
    });

    await createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 120_000, ACTOR_ID, ENROLLMENT_DATE);

    // 6 inserts total: owner, plan, payments, risk pool, audit(plan), audit(risk pool)
    expect(insertedValues).toHaveLength(6);

    // 5th insert = plan audit log
    const planAudit = insertedValues[4] as { entityType: string; action: string; actorId: string };
    expect(planAudit.entityType).toBe('plan');
    expect(planAudit.action).toBe('created');
    expect(planAudit.actorId).toBe(ACTOR_ID);

    // 6th insert = risk pool audit log
    const riskAudit = insertedValues[5] as { entityType: string; action: string };
    expect(riskAudit.entityType).toBe('risk_pool');
    expect(riskAudit.action).toBe('contribution');
  });

  it('passes plain objects (not JSON.stringify) to audit log newValue', async () => {
    setupOuterSelectChain([{ id: CLINIC_ID, status: 'active' }]);

    const tx = createMockTx();
    const insertedValues: unknown[] = [];

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      let insertCount = 0;

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

      mockInsert.mockImplementation(() => {
        insertCount++;
        return {
          values: (val: unknown) => {
            insertedValues.push(val);
            if (insertCount <= 3) {
              return {
                returning: () => Promise.resolve([{ id: `mock-id-${insertCount}` }]),
              };
            }
            return Promise.resolve([]);
          },
        };
      });

      return fn(tx);
    });

    await createEnrollment(CLINIC_ID, VALID_OWNER_DATA, 120_000, ACTOR_ID, ENROLLMENT_DATE);

    // Plan audit log (5th insert) — newValue should be a plain object, not a JSON string
    const planAudit = insertedValues[4] as { newValue: unknown };
    expect(typeof planAudit.newValue).toBe('object');
    expect(typeof planAudit.newValue).not.toBe('string');

    // Risk pool audit log (6th insert) — newValue should be a plain object
    const riskAudit = insertedValues[5] as { newValue: unknown };
    expect(typeof riskAudit.newValue).toBe('object');
    expect(typeof riskAudit.newValue).not.toBe('string');
  });
});

// ── getEnrollmentSummary tests ───────────────────────────────────────

describe('getEnrollmentSummary', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it('throws when plan is not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await expect(getEnrollmentSummary(PLAN_ID)).rejects.toThrow('not found');
  });

  it('throws when plan has no associated owner', async () => {
    mockFindFirst.mockResolvedValue({
      id: PLAN_ID,
      status: 'pending',
      totalBillCents: 120_000,
      feeCents: 7_200,
      totalWithFeeCents: 127_200,
      depositCents: 31_800,
      remainingCents: 95_400,
      installmentCents: 15_900,
      numInstallments: 6,
      createdAt: new Date(),
      owner: null,
      clinic: { id: CLINIC_ID, name: 'Happy Paws Vet' },
      payments: [],
    });

    await expect(getEnrollmentSummary(PLAN_ID)).rejects.toThrow('no associated owner');
  });

  it('throws when plan has no associated clinic', async () => {
    mockFindFirst.mockResolvedValue({
      id: PLAN_ID,
      status: 'pending',
      totalBillCents: 120_000,
      feeCents: 7_200,
      totalWithFeeCents: 127_200,
      depositCents: 31_800,
      remainingCents: 95_400,
      installmentCents: 15_900,
      numInstallments: 6,
      createdAt: new Date(),
      owner: {
        id: OWNER_ID,
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        petName: 'Whiskers',
      },
      clinic: null,
      payments: [],
    });

    await expect(getEnrollmentSummary(PLAN_ID)).rejects.toThrow('no associated clinic');
  });

  it('returns full enrollment summary when plan exists', async () => {
    const createdAt = new Date('2026-03-01T12:00:00Z');
    const scheduledAt = new Date('2026-03-01T12:00:00Z');

    mockFindFirst.mockResolvedValue({
      id: PLAN_ID,
      status: 'pending',
      totalBillCents: 120_000,
      feeCents: 7_200,
      totalWithFeeCents: 127_200,
      depositCents: 31_800,
      remainingCents: 95_400,
      installmentCents: 15_900,
      numInstallments: 6,
      createdAt,
      owner: {
        id: OWNER_ID,
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        petName: 'Whiskers',
      },
      clinic: {
        id: CLINIC_ID,
        name: 'Happy Paws Vet',
      },
      payments: [
        {
          id: 'pay-0',
          type: 'deposit',
          sequenceNum: 0,
          amountCents: 31_800,
          status: 'pending',
          scheduledAt,
        },
      ],
    });

    const summary = await getEnrollmentSummary(PLAN_ID);

    expect(summary.plan.id).toBe(PLAN_ID);
    expect(summary.plan.totalBillCents).toBe(120_000);
    expect(summary.plan.feeCents).toBe(7_200);
    expect(summary.owner.name).toBe('Jane Doe');
    expect(summary.owner.petName).toBe('Whiskers');
    expect(summary.clinic.name).toBe('Happy Paws Vet');
    expect(summary.payments).toHaveLength(1);
    expect(summary.payments[0].type).toBe('deposit');
  });

  it('uses a single relational query (db.query.plans.findFirst)', async () => {
    mockFindFirst.mockResolvedValue({
      id: PLAN_ID,
      status: 'pending',
      totalBillCents: 120_000,
      feeCents: 7_200,
      totalWithFeeCents: 127_200,
      depositCents: 31_800,
      remainingCents: 95_400,
      installmentCents: 15_900,
      numInstallments: 6,
      createdAt: new Date(),
      owner: {
        id: OWNER_ID,
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        petName: 'Whiskers',
      },
      clinic: { id: CLINIC_ID, name: 'Happy Paws Vet' },
      payments: [],
    });

    await getEnrollmentSummary(PLAN_ID);

    // Should use a single findFirst call instead of 4 separate selects
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockOuterSelect).not.toHaveBeenCalled();
  });
});

// ── cancelEnrollment tests ───────────────────────────────────────────

describe('cancelEnrollment', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it('throws when plan is not found', async () => {
    setupOuterSelectChain([]);

    await expect(cancelEnrollment(PLAN_ID)).rejects.toThrow('not found');
  });

  it('throws when plan is completed', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'completed' }]);

    await expect(cancelEnrollment(PLAN_ID)).rejects.toThrow("status is 'completed'");
  });

  it('throws when plan is already cancelled', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'cancelled' }]);

    await expect(cancelEnrollment(PLAN_ID)).rejects.toThrow("status is 'cancelled'");
  });

  it('throws when plan is defaulted', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'defaulted' }]);

    await expect(cancelEnrollment(PLAN_ID)).rejects.toThrow("status is 'defaulted'");
  });

  /**
   * Helper to set up the mock transaction for cancelEnrollment tests.
   * Provides tracking of updates, inserts, and select calls within tx.
   */
  function setupCancelTxMocks(opts: {
    pendingPayments?: Array<{ id: string; status: string }>;
    softCollection?: { id: string; stage: string } | null;
  }) {
    const { pendingPayments = [], softCollection = null } = opts;
    const tx = createMockTx();
    const updatedEntities: Array<{ values: unknown }> = [];
    const insertedValues: unknown[] = [];

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      let selectCount = 0;

      mockUpdate.mockImplementation(() => {
        return {
          set: (val: unknown) => {
            updatedEntities.push({ values: val });
            return {
              where: () => Promise.resolve([]),
            };
          },
        };
      });

      mockSelect.mockImplementation(() => {
        selectCount++;
        return {
          from: () => ({
            where: () => {
              if (selectCount === 1) {
                // First tx.select: pending payments lookup
                return Promise.resolve(pendingPayments);
              }
              // Second tx.select: soft collection lookup
              return {
                limit: () => Promise.resolve(softCollection ? [softCollection] : []),
              };
            },
          }),
        };
      });

      mockInsert.mockImplementation(() => ({
        values: (val: unknown) => {
          insertedValues.push(val);
          return Promise.resolve([]);
        },
      }));

      return fn(tx);
    });

    return { updatedEntities, insertedValues };
  }

  it('cancels a pending plan and writes off payments', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'pending' }]);

    const pendingPayments = [
      { id: 'pay-0', status: 'pending' },
      { id: 'pay-1', status: 'pending' },
    ];

    const { updatedEntities, insertedValues } = setupCancelTxMocks({ pendingPayments });

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'clinic');

    // First update: plan status -> cancelled
    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });

    // Second update: payments status -> written_off
    expect(updatedEntities[1].values).toEqual({ status: 'written_off' });

    // Should have audit logs for each payment + plan
    // payment audit entries (2) + plan audit entry (1) = 3
    expect(insertedValues).toHaveLength(3);

    // First two inserts: payment audit logs
    const payAudit0 = insertedValues[0] as { entityType: string; entityId: string };
    expect(payAudit0.entityType).toBe('payment');
    expect(payAudit0.entityId).toBe('pay-0');

    const payAudit1 = insertedValues[1] as { entityType: string; entityId: string };
    expect(payAudit1.entityType).toBe('payment');
    expect(payAudit1.entityId).toBe('pay-1');

    // Last insert: plan audit log
    const planAudit = insertedValues[2] as {
      entityType: string;
      entityId: string;
      action: string;
      actorType: string;
      actorId: string;
    };
    expect(planAudit.entityType).toBe('plan');
    expect(planAudit.entityId).toBe(PLAN_ID);
    expect(planAudit.action).toBe('status_changed');
    expect(planAudit.actorType).toBe('clinic');
    expect(planAudit.actorId).toBe(ACTOR_ID);
  });

  it('cancels an active plan and writes off pending payments', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'active' }]);

    const pendingPayments = [
      { id: 'pay-3', status: 'pending' },
      { id: 'pay-4', status: 'pending' },
      { id: 'pay-5', status: 'pending' },
    ];

    const { updatedEntities, insertedValues } = setupCancelTxMocks({ pendingPayments });

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'admin');

    // First update: plan status -> cancelled
    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });

    // Second update: payments status -> written_off
    expect(updatedEntities[1].values).toEqual({ status: 'written_off' });

    // 3 payment audits + 1 plan audit = 4
    expect(insertedValues).toHaveLength(4);

    // Verify each payment has individual audit entry
    for (let i = 0; i < 3; i++) {
      const payAudit = insertedValues[i] as {
        entityType: string;
        entityId: string;
        action: string;
        newValue: { status: string; reason: string };
      };
      expect(payAudit.entityType).toBe('payment');
      expect(payAudit.entityId).toBe(pendingPayments[i].id);
      expect(payAudit.action).toBe('status_changed');
      expect(payAudit.newValue.status).toBe('written_off');
      expect(payAudit.newValue.reason).toBe('plan_cancelled');
    }

    // Plan audit
    const planAudit = insertedValues[3] as {
      entityType: string;
      oldValue: { status: string };
      newValue: { status: string };
    };
    expect(planAudit.entityType).toBe('plan');
    expect(planAudit.oldValue).toEqual({ status: 'active' });
    expect(planAudit.newValue).toEqual({ status: 'cancelled' });
  });

  it('cancels a deposit_paid plan', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'deposit_paid' }]);

    const pendingPayments = [{ id: 'pay-1', status: 'pending' }];

    const { updatedEntities, insertedValues } = setupCancelTxMocks({ pendingPayments });

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'clinic');

    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });
    expect(updatedEntities[1].values).toEqual({ status: 'written_off' });

    // 1 payment audit + 1 plan audit = 2
    expect(insertedValues).toHaveLength(2);
  });

  it('cancels associated soft collection when present', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'active' }]);

    const pendingPayments = [{ id: 'pay-3', status: 'pending' }];
    const softCollection = { id: 'sc-1', stage: 'day_1_reminder' };

    const { updatedEntities, insertedValues } = setupCancelTxMocks({
      pendingPayments,
      softCollection,
    });

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'admin');

    // First update: plan -> cancelled
    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });

    // Second update: payments -> written_off
    expect(updatedEntities[1].values).toEqual({ status: 'written_off' });

    // Third update: soft collection -> cancelled
    expect(updatedEntities[2].values).toEqual({
      stage: 'cancelled',
      nextEscalationAt: null,
      notes: 'Collection cancelled when plan was cancelled',
    });

    // 1 payment audit + 1 soft collection audit + 1 plan audit = 3
    expect(insertedValues).toHaveLength(3);

    // Verify soft collection audit entry
    const scAudit = insertedValues[1] as {
      entityType: string;
      oldValue: { softCollectionStage: string };
      newValue: { softCollectionStage: string; reason: string };
    };
    expect(scAudit.entityType).toBe('plan');
    expect(scAudit.oldValue.softCollectionStage).toBe('day_1_reminder');
    expect(scAudit.newValue.softCollectionStage).toBe('cancelled');
  });

  it('skips soft collection cancellation when already cancelled', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'active' }]);

    const softCollection = { id: 'sc-1', stage: 'cancelled' };

    const { updatedEntities } = setupCancelTxMocks({
      pendingPayments: [],
      softCollection,
    });

    await cancelEnrollment(PLAN_ID);

    // Only plan update — no soft collection update (it's already cancelled)
    expect(updatedEntities).toHaveLength(1);
    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });
  });

  it('handles plans with no pending payments gracefully', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'active' }]);

    const { updatedEntities, insertedValues } = setupCancelTxMocks({
      pendingPayments: [],
    });

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'admin');

    // Only plan update, no payment update
    expect(updatedEntities).toHaveLength(1);
    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });

    // Only plan audit log, no payment audits
    expect(insertedValues).toHaveLength(1);
    const planAudit = insertedValues[0] as { entityType: string };
    expect(planAudit.entityType).toBe('plan');
  });

  it('uses system as default actor type when not specified', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'pending' }]);

    const { insertedValues } = setupCancelTxMocks({ pendingPayments: [] });

    await cancelEnrollment(PLAN_ID);

    const auditEntry = insertedValues[0] as { actorType: string; actorId: string | null };
    expect(auditEntry.actorType).toBe('system');
    expect(auditEntry.actorId).toBeNull();
  });

  it('passes plain objects (not JSON.stringify) to audit log oldValue/newValue', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'pending' }]);

    const { insertedValues } = setupCancelTxMocks({
      pendingPayments: [{ id: 'pay-0', status: 'pending' }],
    });

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'clinic');

    // Check all audit entries have plain object values
    for (const entry of insertedValues) {
      const audit = entry as { oldValue: unknown; newValue: unknown };
      expect(typeof audit.oldValue).toBe('object');
      expect(typeof audit.oldValue).not.toBe('string');
      expect(typeof audit.newValue).toBe('object');
      expect(typeof audit.newValue).not.toBe('string');
    }
  });
});
