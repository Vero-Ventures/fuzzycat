import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

mock.module('@/lib/env', () => ({
  publicEnv: () => ({
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  }),
}));

// DB mock setup
const mockSelectLimit = mock();
const mockSelectWhere = mock();
const mockSelectFrom = mock();
const mockSelect = mock();
const mockUpdateReturning = mock();
const mockUpdateWhere = mock();
const mockUpdateSet = mock();
const mockUpdate = mock();
const mockInsertReturning = mock();
const mockInsertValues = mock();
const mockInsert = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

mock.module('@/server/db/schema', () => ({
  softCollections: {
    id: 'soft_collections.id',
    planId: 'soft_collections.plan_id',
    stage: 'soft_collections.stage',
    startedAt: 'soft_collections.started_at',
    lastEscalatedAt: 'soft_collections.last_escalated_at',
    nextEscalationAt: 'soft_collections.next_escalation_at',
    notes: 'soft_collections.notes',
    createdAt: 'soft_collections.created_at',
    updatedAt: 'soft_collections.updated_at',
  },
  plans: {
    id: 'plans.id',
    ownerId: 'plans.owner_id',
    clinicId: 'plans.clinic_id',
    remainingCents: 'plans.remaining_cents',
    status: 'plans.status',
  },
  owners: {
    id: 'owners.id',
    name: 'owners.name',
    email: 'owners.email',
    phone: 'owners.phone',
    petName: 'owners.pet_name',
  },
  softCollectionStageEnum: mock(),
}));

const mockLogAuditEvent = mock();
mock.module('@/server/services/audit', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

const mockSendDay1 = mock();
const mockSendDay7 = mock();
const mockSendDay14 = mock();
mock.module('@/server/services/email', () => ({
  sendSoftCollectionDay1: mockSendDay1,
  sendSoftCollectionDay7: mockSendDay7,
  sendSoftCollectionDay14: mockSendDay14,
}));

const mockSendSmsReminder = mock();
mock.module('@/server/services/sms', () => ({
  sendSoftCollectionReminder: mockSendSmsReminder,
}));

// ── Test data ────────────────────────────────────────────────────────

const PLAN_ID = '00000000-0000-0000-0000-000000000001';
const COLLECTION_ID = '00000000-0000-0000-0000-000000000002';

const mockCollection = {
  id: COLLECTION_ID,
  planId: PLAN_ID,
  stage: 'day_1_reminder' as const,
  startedAt: new Date('2026-01-01'),
  lastEscalatedAt: new Date('2026-01-01'),
  nextEscalationAt: new Date('2026-01-07'),
  notes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPlanInfo = {
  planId: PLAN_ID,
  remainingCents: 50000,
  ownerName: 'Jane Doe',
  ownerEmail: 'jane@example.com',
  ownerPhone: '+15551234567',
  petName: 'Whiskers',
  clinicId: '00000000-0000-0000-0000-000000000003',
};

// ── Setup helpers ────────────────────────────────────────────────────

function setupDbChains() {
  // Select chain: select().from().leftJoin().leftJoin().where().limit()
  const mockLeftJoin2 = mock(() => ({ where: mockSelectWhere }));
  const mockLeftJoin1 = mock(() => ({ where: mockSelectWhere, leftJoin: mockLeftJoin2 }));

  mockSelectLimit.mockReturnValue([]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({
    where: mockSelectWhere,
    leftJoin: mockLeftJoin1,
  });
  mockSelect.mockReturnValue({ from: mockSelectFrom });

  // Insert chain: insert().values().returning()
  mockInsertReturning.mockResolvedValue([]);
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  mockInsert.mockReturnValue({ values: mockInsertValues });

  // Update chain: update().set().where().returning()
  mockUpdateReturning.mockResolvedValue([]);
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

beforeEach(() => {
  setupDbChains();
  mockLogAuditEvent.mockResolvedValue(undefined);
  mockSendDay1.mockResolvedValue({ id: 'email-1' });
  mockSendDay7.mockResolvedValue({ id: 'email-2' });
  mockSendDay14.mockResolvedValue({ id: 'email-3' });
  mockSendSmsReminder.mockResolvedValue({ success: true });
});

afterEach(() => {
  mock.restore();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('initiateSoftCollection', () => {
  it('creates a soft collection record and sends Day 1 notifications', async () => {
    mockInsertReturning.mockResolvedValue([{ ...mockCollection }]);
    // First select (idempotency check) returns empty, second (getPlanWithOwner) returns planInfo
    mockSelectLimit.mockReturnValueOnce([]).mockReturnValue([mockPlanInfo]);

    const { initiateSoftCollection } = await import('@/server/services/soft-collection');

    const result = await initiateSoftCollection(PLAN_ID);

    expect(result.id).toBe(COLLECTION_ID);
    expect(result.stage).toBe('day_1_reminder');
    expect(mockInsert).toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'plan',
        entityId: PLAN_ID,
        action: 'status_changed',
      }),
    );
    expect(mockSendDay1).toHaveBeenCalled();
    expect(mockSendSmsReminder).toHaveBeenCalled();
  });

  it('still creates the record even if email fails', async () => {
    mockInsertReturning.mockResolvedValue([{ ...mockCollection }]);
    // First select (idempotency check) returns empty, second (getPlanWithOwner) returns planInfo
    mockSelectLimit.mockReturnValueOnce([]).mockReturnValue([mockPlanInfo]);
    mockSendDay1.mockRejectedValue(new Error('Email failed'));

    const { initiateSoftCollection } = await import('@/server/services/soft-collection');

    const result = await initiateSoftCollection(PLAN_ID);
    expect(result.id).toBe(COLLECTION_ID);
  });

  it('returns existing record when soft collection already exists (idempotent)', async () => {
    // Idempotency check returns existing collection
    mockSelectLimit.mockReturnValue([{ ...mockCollection }]);

    const { initiateSoftCollection } = await import('@/server/services/soft-collection');

    // Track call counts before invocation
    const insertCallsBefore = mockInsertReturning.mock.calls.length;
    const emailCallsBefore = mockSendDay1.mock.calls.length;

    const result = await initiateSoftCollection(PLAN_ID);

    expect(result.id).toBe(COLLECTION_ID);
    expect(result.stage).toBe('day_1_reminder');
    // Should NOT insert or send notifications (no new calls)
    expect(mockInsertReturning.mock.calls.length).toBe(insertCallsBefore);
    expect(mockSendDay1.mock.calls.length).toBe(emailCallsBefore);
  });
});

describe('escalateSoftCollection', () => {
  it('escalates from day_1_reminder to day_7_followup', async () => {
    const updatedRecord = {
      ...mockCollection,
      stage: 'day_7_followup',
      lastEscalatedAt: new Date(),
    };

    // First select returns current record, getPlanWithOwner returns planInfo
    mockSelectLimit.mockReturnValueOnce([{ ...mockCollection }]).mockReturnValue([mockPlanInfo]);
    mockUpdateReturning.mockResolvedValue([updatedRecord]);

    const { escalateSoftCollection } = await import('@/server/services/soft-collection');

    const result = await escalateSoftCollection(COLLECTION_ID);

    expect(result.stage).toBe('day_7_followup');
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('throws when collection is already completed', async () => {
    mockSelectLimit.mockReturnValue([{ ...mockCollection, stage: 'completed' }]);

    const { escalateSoftCollection } = await import('@/server/services/soft-collection');

    await expect(escalateSoftCollection(COLLECTION_ID)).rejects.toThrow(
      'Cannot escalate soft collection in completed stage',
    );
  });

  it('throws when collection is already cancelled', async () => {
    mockSelectLimit.mockReturnValue([{ ...mockCollection, stage: 'cancelled' }]);

    const { escalateSoftCollection } = await import('@/server/services/soft-collection');

    await expect(escalateSoftCollection(COLLECTION_ID)).rejects.toThrow(
      'Cannot escalate soft collection in cancelled stage',
    );
  });

  it('throws when collection is not found', async () => {
    mockSelectLimit.mockReturnValue([]);

    const { escalateSoftCollection } = await import('@/server/services/soft-collection');

    await expect(escalateSoftCollection(COLLECTION_ID)).rejects.toThrow(
      'Soft collection record not found',
    );
  });
});

describe('cancelSoftCollection', () => {
  it('cancels an active collection with a reason', async () => {
    const cancelledRecord = {
      ...mockCollection,
      stage: 'cancelled',
      notes: 'Owner paid',
    };

    mockSelectLimit.mockReturnValue([{ ...mockCollection }]);
    mockUpdateReturning.mockResolvedValue([cancelledRecord]);

    const { cancelSoftCollection } = await import('@/server/services/soft-collection');

    const result = await cancelSoftCollection(COLLECTION_ID, 'Owner paid');

    expect(result.stage).toBe('cancelled');
    expect(result.notes).toBe('Owner paid');
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('throws when trying to cancel a completed collection', async () => {
    mockSelectLimit.mockReturnValue([{ ...mockCollection, stage: 'completed' }]);

    const { cancelSoftCollection } = await import('@/server/services/soft-collection');

    await expect(cancelSoftCollection(COLLECTION_ID, 'test')).rejects.toThrow(
      'Cannot cancel soft collection in completed stage',
    );
  });
});

describe('identifyPendingEscalations', () => {
  it('returns collections with nextEscalationAt in the past', async () => {
    const pastDue = {
      ...mockCollection,
      nextEscalationAt: new Date('2020-01-01'),
    };

    // identifyPendingEscalations uses select().from().where() (no limit)
    mockSelectWhere.mockReturnValue([pastDue]);

    const { identifyPendingEscalations } = await import('@/server/services/soft-collection');

    const result = await identifyPendingEscalations();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('returns empty array when no escalations are pending', async () => {
    mockSelectWhere.mockReturnValue([]);

    const { identifyPendingEscalations } = await import('@/server/services/soft-collection');

    const result = await identifyPendingEscalations();
    expect(result).toHaveLength(0);
  });
});

describe('getSoftCollectionByPlan', () => {
  it('returns the collection record for a plan', async () => {
    mockSelectLimit.mockReturnValue([{ ...mockCollection }]);

    const { getSoftCollectionByPlan } = await import('@/server/services/soft-collection');

    const result = await getSoftCollectionByPlan(PLAN_ID);
    expect(result).toBeDefined();
    expect(result?.planId).toBe(PLAN_ID);
  });

  it('returns null when no collection exists for the plan', async () => {
    mockSelectLimit.mockReturnValue([]);

    const { getSoftCollectionByPlan } = await import('@/server/services/soft-collection');

    const result = await getSoftCollectionByPlan(PLAN_ID);
    expect(result).toBeNull();
  });
});
