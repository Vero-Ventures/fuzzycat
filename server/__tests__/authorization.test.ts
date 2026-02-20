import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { TRPCError } from '@trpc/server';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSelect = mock();
const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelectLimit = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
  },
}));

import { schemaMock } from './stripe/_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

// Must be imported AFTER mocks are set up
const { assertClinicOwnership, assertPlanAccess } = await import('@/server/services/authorization');

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_CLINIC_ID = '11111111-1111-1111-1111-222222222222';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_OWNER_ID = '22222222-2222-2222-2222-333333333333';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';

// ── Helpers ──────────────────────────────────────────────────────────

function clearAllMocks() {
  mockSelect.mockClear();
  mockSelectFrom.mockClear();
  mockSelectWhere.mockClear();
  mockSelectLimit.mockClear();
}

/**
 * Sets up a chain of select queries that return results in order.
 * Each call to db.select().from().where().limit() returns the next result.
 */
function setupSelectChainSequence(results: unknown[][]) {
  let callIndex = 0;
  mockSelect.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: () => {
          const result = results[callIndex] ?? [];
          callIndex++;
          return Promise.resolve(result);
        },
      }),
    }),
  }));
}

// ── assertClinicOwnership tests ──────────────────────────────────────

describe('assertClinicOwnership', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it('allows when clinic authId matches the user and clinic ID matches', async () => {
    setupSelectChainSequence([[{ id: CLINIC_ID }]]);

    await expect(assertClinicOwnership(USER_ID, CLINIC_ID)).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN when no clinic found for the user authId', async () => {
    setupSelectChainSequence([[]]);

    try {
      await assertClinicOwnership(USER_ID, CLINIC_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });

  it('throws FORBIDDEN when clinic authId matches but clinic ID does not', async () => {
    // User is authenticated as a clinic, but not the one they're trying to act as
    setupSelectChainSequence([[{ id: OTHER_CLINIC_ID }]]);

    try {
      await assertClinicOwnership(USER_ID, CLINIC_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });
});

// ── assertPlanAccess tests ───────────────────────────────────────────

describe('assertPlanAccess', () => {
  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  it('throws NOT_FOUND when plan does not exist', async () => {
    setupSelectChainSequence([[]]);

    try {
      await assertPlanAccess(USER_ID, 'clinic', PLAN_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('NOT_FOUND');
    }
  });

  it('allows admin users to access any plan', async () => {
    setupSelectChainSequence([[{ clinicId: CLINIC_ID, ownerId: OWNER_ID }]]);

    const result = await assertPlanAccess(USER_ID, 'admin', PLAN_ID);
    expect(result.clinicId).toBe(CLINIC_ID);
    expect(result.ownerId).toBe(OWNER_ID);
  });

  it('allows clinic user when their clinic matches the plan clinicId', async () => {
    setupSelectChainSequence([
      [{ clinicId: CLINIC_ID, ownerId: OWNER_ID }], // plan lookup
      [{ id: CLINIC_ID }], // clinic authId lookup
    ]);

    const result = await assertPlanAccess(USER_ID, 'clinic', PLAN_ID);
    expect(result.clinicId).toBe(CLINIC_ID);
  });

  it('throws FORBIDDEN for clinic user when clinic does not match plan', async () => {
    setupSelectChainSequence([
      [{ clinicId: CLINIC_ID, ownerId: OWNER_ID }], // plan lookup
      [{ id: OTHER_CLINIC_ID }], // clinic authId lookup — different clinic
    ]);

    try {
      await assertPlanAccess(USER_ID, 'clinic', PLAN_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });

  it('throws FORBIDDEN for clinic user with no clinic record', async () => {
    setupSelectChainSequence([
      [{ clinicId: CLINIC_ID, ownerId: OWNER_ID }], // plan lookup
      [], // no clinic found for authId
    ]);

    try {
      await assertPlanAccess(USER_ID, 'clinic', PLAN_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });

  it('allows owner user when their owner record matches the plan ownerId', async () => {
    setupSelectChainSequence([
      [{ clinicId: CLINIC_ID, ownerId: OWNER_ID }], // plan lookup
      [{ id: OWNER_ID }], // owner authId lookup
    ]);

    const result = await assertPlanAccess(USER_ID, 'owner', PLAN_ID);
    expect(result.ownerId).toBe(OWNER_ID);
  });

  it('throws FORBIDDEN for owner user when owner does not match plan', async () => {
    setupSelectChainSequence([
      [{ clinicId: CLINIC_ID, ownerId: OWNER_ID }], // plan lookup
      [{ id: OTHER_OWNER_ID }], // different owner
    ]);

    try {
      await assertPlanAccess(USER_ID, 'owner', PLAN_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });

  it('throws FORBIDDEN for owner user with no owner record', async () => {
    setupSelectChainSequence([
      [{ clinicId: CLINIC_ID, ownerId: OWNER_ID }], // plan lookup
      [], // no owner found for authId
    ]);

    try {
      await assertPlanAccess(USER_ID, 'owner', PLAN_ID);
      expect.unreachable('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe('FORBIDDEN');
    }
  });

  it('admin bypass does not query clinic or owner tables', async () => {
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount++;
            // Only the plan lookup
            return Promise.resolve([{ clinicId: CLINIC_ID, ownerId: OWNER_ID }]);
          },
        }),
      }),
    }));

    await assertPlanAccess(USER_ID, 'admin', PLAN_ID);

    // Admin should only trigger the plan lookup (1 query), not clinic/owner lookups
    expect(selectCallCount).toBe(1);
  });
});
