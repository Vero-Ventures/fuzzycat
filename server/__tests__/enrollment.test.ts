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

mock.module('@/server/db', () => ({
  db: {
    select: mockOuterSelect,
    transaction: mockTransaction,
  },
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

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

  it('reuses existing owner record when email and clinicId match', async () => {
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
    mockOuterSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));

    await expect(getEnrollmentSummary(PLAN_ID)).rejects.toThrow('not found');
  });

  it('returns full enrollment summary when plan exists', async () => {
    const createdAt = new Date('2026-03-01T12:00:00Z');
    const scheduledAt = new Date('2026-03-01T12:00:00Z');

    let callCount = 0;
    mockOuterSelect.mockImplementation(() => {
      callCount++;

      if (callCount === 1) {
        // Plan lookup
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
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
                    ownerId: OWNER_ID,
                    clinicId: CLINIC_ID,
                  },
                ]),
            }),
          }),
        };
      }
      if (callCount === 2) {
        // Owner lookup
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: OWNER_ID,
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    phone: '555-0100',
                    petName: 'Whiskers',
                  },
                ]),
            }),
          }),
        };
      }
      if (callCount === 3) {
        // Clinic lookup
        return {
          from: () => ({
            where: () => ({
              limit: () =>
                Promise.resolve([
                  {
                    id: CLINIC_ID,
                    name: 'Happy Paws Vet',
                  },
                ]),
            }),
          }),
        };
      }
      // Payments lookup (no limit)
      return {
        from: () => ({
          where: () =>
            Promise.resolve([
              {
                id: 'pay-0',
                type: 'deposit',
                sequenceNum: 0,
                amountCents: 31_800,
                status: 'pending',
                scheduledAt,
              },
            ]),
        }),
      };
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

  it('throws when plan status is not pending', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'active' }]);

    await expect(cancelEnrollment(PLAN_ID)).rejects.toThrow("status is 'active'");
  });

  it('throws when plan is already cancelled', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'cancelled' }]);

    await expect(cancelEnrollment(PLAN_ID)).rejects.toThrow("status is 'cancelled'");
  });

  it('cancels a pending plan and writes off payments', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'pending' }]);

    const tx = createMockTx();
    const updatedEntities: Array<{ table: string; values: unknown }> = [];
    const insertedValues: unknown[] = [];

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      let updateCount = 0;
      mockUpdate.mockImplementation(() => {
        updateCount++;
        return {
          set: (val: unknown) => {
            updatedEntities.push({ table: `update-${updateCount}`, values: val });
            return {
              where: () => Promise.resolve([]),
            };
          },
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

    await cancelEnrollment(PLAN_ID, ACTOR_ID, 'clinic');

    // First update: plan status -> cancelled
    expect(updatedEntities[0].values).toEqual({ status: 'cancelled' });

    // Second update: payments status -> written_off
    expect(updatedEntities[1].values).toEqual({ status: 'written_off' });

    // Audit log entry
    const auditEntry = insertedValues[0] as {
      entityType: string;
      entityId: string;
      action: string;
      actorType: string;
      actorId: string;
    };
    expect(auditEntry.entityType).toBe('plan');
    expect(auditEntry.entityId).toBe(PLAN_ID);
    expect(auditEntry.action).toBe('status_changed');
    expect(auditEntry.actorType).toBe('clinic');
    expect(auditEntry.actorId).toBe(ACTOR_ID);
  });

  it('uses system as default actor type when not specified', async () => {
    setupOuterSelectChain([{ id: PLAN_ID, status: 'pending' }]);

    const tx = createMockTx();
    const insertedValues: unknown[] = [];

    mockTransaction.mockImplementation(async (fn: TxCallback) => {
      mockUpdate.mockReturnValue({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      });

      mockInsert.mockImplementation(() => ({
        values: (val: unknown) => {
          insertedValues.push(val);
          return Promise.resolve([]);
        },
      }));

      return fn(tx);
    });

    await cancelEnrollment(PLAN_ID);

    const auditEntry = insertedValues[0] as { actorType: string; actorId: string | null };
    expect(auditEntry.actorType).toBe('system');
    expect(auditEntry.actorId).toBeNull();
  });
});
