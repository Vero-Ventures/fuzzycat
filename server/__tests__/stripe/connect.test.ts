import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

const mockAccountsCreate = mock(() => Promise.resolve({ id: 'acct_clinic_123' }));
const mockAccountLinksCreate = mock(() =>
  Promise.resolve({ url: 'https://connect.stripe.com/setup/e/acct_clinic_123' }),
);
mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    accounts: { create: mockAccountsCreate },
    accountLinks: { create: mockAccountLinksCreate },
  }),
}));

import { schemaMock } from './_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsert = mock();

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    update: mockUpdate,
    insert: mockInsert,
  };
  return fn(tx);
});

mock.module('@/server/db', () => ({
  db: {
    update: mockUpdate,
    insert: mockInsert,
    transaction: mockTransaction,
  },
}));

const { createConnectAccount, createOnboardingLink } = await import(
  '@/server/services/stripe/connect'
);

// ── Tests ────────────────────────────────────────────────────────────

describe('createConnectAccount', () => {
  beforeEach(() => {
    mockUpdateWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    mockInsertValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  afterEach(() => {
    mockAccountsCreate.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
  });

  it('creates a Standard Connect account', async () => {
    const result = await createConnectAccount({
      clinicId: 'clinic-1',
      email: 'clinic@example.com',
      businessName: 'Happy Paws Vet',
    });

    expect(result.accountId).toBe('acct_clinic_123');
    expect(mockAccountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'standard',
        email: 'clinic@example.com',
        metadata: { clinicId: 'clinic-1' },
      }),
      expect.objectContaining({
        idempotencyKey: 'create_connect_clinic-1',
      }),
    );
  });

  it('passes clinic-specific idempotency key to prevent duplicate accounts', async () => {
    await createConnectAccount({
      clinicId: 'clinic-race-test',
      email: 'race@example.com',
      businessName: 'Race Vet',
    });

    const callArgs = mockAccountsCreate.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(callArgs[1]).toEqual({ idempotencyKey: 'create_connect_clinic-race-test' });
  });

  it('stores the Connect account ID in the clinics table', async () => {
    await createConnectAccount({
      clinicId: 'clinic-1',
      email: 'clinic@example.com',
      businessName: 'Happy Paws Vet',
    });

    expect(mockUpdateSet).toHaveBeenCalledWith({ stripeAccountId: 'acct_clinic_123' });
  });

  it('creates an audit log entry', async () => {
    await createConnectAccount({
      clinicId: 'clinic-1',
      email: 'clinic@example.com',
      businessName: 'Happy Paws Vet',
    });

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'clinic',
        entityId: 'clinic-1',
        action: 'stripe_connect_created',
        actorType: 'system',
      }),
    );
  });

  it('throws and logs when DB transaction fails', async () => {
    mockTransaction.mockImplementation(async () => {
      throw new Error('DB connection lost');
    });

    await expect(
      createConnectAccount({
        clinicId: 'clinic-1',
        email: 'clinic@example.com',
        businessName: 'Happy Paws Vet',
      }),
    ).rejects.toThrow('DB connection lost');

    // Restore normal transaction behavior for subsequent tests
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        update: mockUpdate,
        insert: mockInsert,
      };
      return fn(tx);
    });
  });
});

describe('createOnboardingLink', () => {
  afterEach(() => {
    mockAccountLinksCreate.mockClear();
  });

  it('generates an onboarding link', async () => {
    const result = await createOnboardingLink({
      stripeAccountId: 'acct_clinic_123',
      returnUrl: 'https://app.example.com/clinic/settings',
      refreshUrl: 'https://app.example.com/clinic/settings/refresh',
    });

    expect(result.url).toBe('https://connect.stripe.com/setup/e/acct_clinic_123');
    expect(mockAccountLinksCreate).toHaveBeenCalledWith({
      account: 'acct_clinic_123',
      type: 'account_onboarding',
      return_url: 'https://app.example.com/clinic/settings',
      refresh_url: 'https://app.example.com/clinic/settings/refresh',
    });
  });
});
