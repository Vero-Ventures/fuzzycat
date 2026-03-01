import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { _resetEnvCache } from '@/lib/env';

// ── Env setup ─────────────────────────────────────────────────────────
_resetEnvCache();
for (const [key, val] of Object.entries({
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  DATABASE_URL: 'postgres://test:test@localhost/test',
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_placeholder',
  RESEND_API_KEY: 're_test_placeholder',
  PLAID_CLIENT_ID: 'test-plaid-client',
  PLAID_SECRET: 'test-plaid-secret',
  PLAID_ENV: 'sandbox',
  TWILIO_ACCOUNT_SID: 'ACtest_placeholder',
  TWILIO_AUTH_TOKEN: 'test-auth-token',
  TWILIO_PHONE_NUMBER: '+15551234567',
} as Record<string, string>)) {
  if (!process.env[key]) process.env[key] = val;
}
// biome-ignore lint/performance/noDelete: process.env requires delete to truly unset
delete process.env.ENABLE_MFA;

// ── Mocks ─────────────────────────────────────────────────────────────

const mockSelect = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsertReturning = mock();
const mockInsert = mock();
const mockDeleteMock = mock();

// biome-ignore lint/suspicious/noExplicitAny: test mock
const dbMock: any = {
  select: mockSelect,
  update: mockUpdate,
  insert: mockInsert,
  delete: mockDeleteMock,
};

mockInsertValues.mockImplementation(() => ({ returning: mockInsertReturning }));
mockInsertReturning.mockImplementation(() => Promise.resolve([]));
mockInsert.mockImplementation(() => ({ values: mockInsertValues }));

function resetDbMocks() {
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockInsertReturning.mockClear();
  mockDeleteMock.mockClear();

  mockInsertValues.mockImplementation(() => ({ returning: mockInsertReturning }));
  mockInsertReturning.mockImplementation(() => Promise.resolve([]));
  mockInsert.mockImplementation(() => ({ values: mockInsertValues }));
}

// biome-ignore lint/suspicious/noExplicitAny: test mock
function createMockChain(results: any[]) {
  let callIndex = 0;

  // biome-ignore lint/suspicious/noExplicitAny: test mock
  const chain = (res: any) => {
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const obj: any = {
      from: () => obj,
      where: () => obj,
      limit: () => obj,
      offset: () => obj,
      orderBy: () => obj,
      groupBy: () => obj,
      innerJoin: () => obj,
      leftJoin: () => obj,
      returning: () => {
        // Consume next result for returning
        const returnRes = results[callIndex] ?? res;
        callIndex++;
        return chain(returnRes);
      },
      set: () => obj,
      values: () => {
        // For insert().values().returning() pattern
        return obj;
      },
      // Make it thenable to support await
      // biome-ignore lint/suspicious/noThenProperty: drizzle query chain
      then: (
        // biome-ignore lint/suspicious/noExplicitAny: test mock
        resolve: any,
      ) => resolve(res),
    };
    return obj;
  };

  mockSelect.mockImplementation(() => {
    const res = results[callIndex] ?? [];
    callIndex++;
    return chain(res);
  });

  mockUpdate.mockImplementation(() => {
    const res = results[callIndex] ?? [];
    callIndex++;
    return chain(res);
  });

  mockInsert.mockImplementation(() => {
    const res = results[callIndex] ?? [];
    callIndex++;
    return chain(res);
  });

  mockDeleteMock.mockImplementation(() => {
    const res = results[callIndex] ?? [];
    callIndex++;
    return chain(res);
  });
}

mock.module('@/server/db', () => ({ db: dbMock }));
mock.module('@/lib/logger', () => ({ logger: { info: mock(), warn: mock(), error: mock() } }));

mock.module('next/cache', () => ({
  unstable_cache: mock((fn: () => unknown) => fn),
  revalidateTag: mock(),
}));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    paymentMethods: { retrieve: mock() },
    customers: { retrieveSource: mock() },
    checkout: { sessions: { create: mock(), retrieve: mock() } },
    setupIntents: { retrieve: mock() },
  }),
}));

// ── Router + caller setup ─────────────────────────────────────────────

const { ownerRouter } = await import('@/server/routers/owner');
const { createCallerFactory } = await import('@/server/trpc');

const createOwnerCaller = createCallerFactory(ownerRouter);

// ── Test data ─────────────────────────────────────────────────────────

const OWNER_ID = '22222222-2222-2222-a222-222222222222';
const OTHER_OWNER_ID = '99999999-9999-9999-9999-999999999999';
const PET_ID = '44444444-4444-4444-a444-444444444444';
const USER_ID = 'user-test-owner';

// biome-ignore lint/suspicious/noExplicitAny: test context
function ctx(overrides?: Record<string, unknown>): any {
  return {
    db: dbMock,
    session: { userId: USER_ID, role: 'owner' },
    supabase: {
      auth: {
        mfa: {
          listFactors: () => Promise.resolve({ data: { totp: [] } }),
          getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal1' } }),
        },
      },
    },
    ...overrides,
  };
}

// ── updateProfile with address fields ─────────────────────────────────

describe('owner.updateProfile with address fields', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('updates address fields and returns updated profile', async () => {
    const updated = {
      id: OWNER_ID,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+15551234567',
      petName: 'Whiskers',
      paymentMethod: 'debit_card',
      addressLine1: '456 Oak Ave',
      addressCity: 'Portland',
      addressState: 'OR',
      addressZip: '97201',
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [updated], // update returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.updateProfile({
      addressLine1: '456 Oak Ave',
      addressCity: 'Portland',
      addressState: 'OR',
      addressZip: '97201',
    });
    expect(result.addressLine1).toBe('456 Oak Ave');
    expect(result.addressCity).toBe('Portland');
    expect(result.addressState).toBe('OR');
    expect(result.addressZip).toBe('97201');
  });

  it('rejects invalid state abbreviation', async () => {
    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updateProfile({ addressState: 'California' })).rejects.toThrow();
  });

  it('rejects invalid ZIP code', async () => {
    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updateProfile({ addressZip: 'abc' })).rejects.toThrow();
  });

  it('accepts ZIP+4 format', async () => {
    const updated = {
      id: OWNER_ID,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+15551234567',
      petName: 'Whiskers',
      paymentMethod: 'debit_card',
      addressLine1: '123 Main St',
      addressCity: 'Anytown',
      addressState: 'CA',
      addressZip: '90210-1234',
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [updated], // update returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.updateProfile({ addressZip: '90210-1234' });
    expect(result.addressZip).toBe('90210-1234');
  });
});

// ── getPets ───────────────────────────────────────────────────────────

describe('owner.getPets', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('returns all pets for the authenticated owner', async () => {
    const petList = [
      {
        id: PET_ID,
        name: 'Buddy',
        species: 'dog',
        breed: 'Labrador',
        age: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'Whiskers',
        species: 'cat',
        breed: 'Siamese',
        age: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      petList, // getPets query
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPets();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Buddy');
    expect(result[1].name).toBe('Whiskers');
  });

  it('returns empty array when no pets', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // no pets
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.getPets();
    expect(result).toEqual([]);
  });
});

// ── addPet ────────────────────────────────────────────────────────────

describe('owner.addPet', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('creates a new pet and returns it', async () => {
    const newPet = {
      id: PET_ID,
      name: 'Buddy',
      species: 'dog',
      breed: 'Labrador',
      age: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [newPet], // insert values (consumed by chain)
      [newPet], // returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.addPet({
      name: 'Buddy',
      species: 'dog',
      breed: 'Labrador',
      age: 3,
    });
    expect(result.name).toBe('Buddy');
    expect(result.species).toBe('dog');
  });

  it('creates a pet without optional fields', async () => {
    const newPet = {
      id: PET_ID,
      name: 'Mystery',
      species: 'other',
      breed: null,
      age: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [newPet], // insert values
      [newPet], // returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.addPet({
      name: 'Mystery',
      species: 'other',
    });
    expect(result.name).toBe('Mystery');
    expect(result.breed).toBeNull();
    expect(result.age).toBeNull();
  });

  it('rejects empty pet name', async () => {
    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.addPet({ name: '', species: 'dog' })).rejects.toThrow();
  });

  it('rejects invalid species', async () => {
    createMockChain([[{ id: OWNER_ID }]]);

    const caller = createOwnerCaller(ctx());
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
      caller.addPet({ name: 'Buddy', species: 'fish' as any }),
    ).rejects.toThrow();
  });
});

// ── updatePet ─────────────────────────────────────────────────────────

describe('owner.updatePet', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('updates an existing pet', async () => {
    const updatedPet = {
      id: PET_ID,
      name: 'Buddy Jr',
      species: 'dog',
      breed: 'Golden Retriever',
      age: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PET_ID, ownerId: OWNER_ID }], // ownership check
      [updatedPet], // update returning
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.updatePet({
      petId: PET_ID,
      name: 'Buddy Jr',
      breed: 'Golden Retriever',
      age: 4,
    });
    expect(result.name).toBe('Buddy Jr');
    expect(result.breed).toBe('Golden Retriever');
  });

  it('throws NOT_FOUND when pet does not exist', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // pet not found
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updatePet({ petId: PET_ID, name: 'New Name' })).rejects.toThrow(
      'Pet not found',
    );
  });

  it('throws FORBIDDEN when pet belongs to different owner', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PET_ID, ownerId: OTHER_OWNER_ID }], // different owner
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updatePet({ petId: PET_ID, name: 'New Name' })).rejects.toThrow(
      'You do not own this pet',
    );
  });

  it('throws BAD_REQUEST when no fields to update', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PET_ID, ownerId: OWNER_ID }], // ownership check
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.updatePet({ petId: PET_ID })).rejects.toThrow('No fields to update');
  });
});

// ── removePet ─────────────────────────────────────────────────────────

describe('owner.removePet', () => {
  beforeEach(resetDbMocks);
  afterEach(resetDbMocks);

  it('removes an owned pet', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PET_ID, ownerId: OWNER_ID, name: 'Buddy' }], // ownership check
      [], // delete result
    ]);

    const caller = createOwnerCaller(ctx());
    const result = await caller.removePet({ petId: PET_ID });
    expect(result.success).toBe(true);
  });

  it('throws NOT_FOUND when pet does not exist', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [], // pet not found
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.removePet({ petId: PET_ID })).rejects.toThrow('Pet not found');
  });

  it('throws FORBIDDEN when pet belongs to different owner', async () => {
    createMockChain([
      [{ id: OWNER_ID }], // middleware
      [{ id: PET_ID, ownerId: OTHER_OWNER_ID, name: 'NotMyPet' }], // different owner
    ]);

    const caller = createOwnerCaller(ctx());
    await expect(caller.removePet({ petId: PET_ID })).rejects.toThrow('You do not own this pet');
  });
});
