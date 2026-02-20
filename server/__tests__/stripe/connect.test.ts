import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { CLINIC_SHARE_RATE } from '@/lib/constants';
import { percentOfCents } from '@/lib/utils/money';

// ── Mocks ────────────────────────────────────────────────────────────

const mockAccountsCreate = mock(() => Promise.resolve({ id: 'acct_clinic_123' }));
const mockAccountLinksCreate = mock(() =>
  Promise.resolve({ url: 'https://connect.stripe.com/setup/e/acct_clinic_123' }),
);
const mockTransfersCreate = mock(() => Promise.resolve({ id: 'tr_transfer_789' }));

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    accounts: { create: mockAccountsCreate },
    accountLinks: { create: mockAccountLinksCreate },
    transfers: { create: mockTransfersCreate },
  }),
}));

import { schemaMock } from './_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsertReturning = mock();
const mockInsert = mock();

mock.module('@/server/db', () => ({
  db: {
    update: mockUpdate,
    insert: mockInsert,
  },
}));

const { createConnectAccount, createOnboardingLink, transferToClinic } = await import(
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
    );
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

describe('transferToClinic', () => {
  const defaultParams = {
    paymentId: 'pay-3',
    planId: 'plan-1',
    clinicId: 'clinic-1',
    clinicStripeAccountId: 'acct_clinic_123',
    amountCents: 15_900,
  };

  beforeEach(() => {
    mockUpdateWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    mockInsertReturning.mockResolvedValue([{ id: 'payout-1' }]);
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  afterEach(() => {
    mockTransfersCreate.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
    mockInsertReturning.mockClear();
  });

  it('creates a transfer with correct destination and amount', async () => {
    const result = await transferToClinic(defaultParams);

    expect(result.transferId).toBe('tr_transfer_789');
    expect(mockTransfersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15_900,
        currency: 'usd',
        destination: 'acct_clinic_123',
      }),
    );
  });

  it('creates a payout record with clinic share calculation', async () => {
    await transferToClinic(defaultParams);

    const expectedClinicShare = percentOfCents(15_900, CLINIC_SHARE_RATE);

    // The first insert call is for the payout record (has returning)
    // The second insert call is for the audit log
    const firstInsertCall = mockInsertValues.mock.calls[0][0];
    expect(firstInsertCall).toEqual(
      expect.objectContaining({
        clinicId: 'clinic-1',
        planId: 'plan-1',
        paymentId: 'pay-3',
        amountCents: 15_900,
        clinicShareCents: expectedClinicShare,
        stripeTransferId: 'tr_transfer_789',
        status: 'succeeded',
      }),
    );
  });

  it('returns the payout record ID', async () => {
    const result = await transferToClinic(defaultParams);

    expect(result.payoutRecord.id).toBe('payout-1');
  });

  it('creates an audit log entry for the payout', async () => {
    await transferToClinic(defaultParams);

    // Second insert call is the audit log
    const auditInsertCall = mockInsertValues.mock.calls[1][0];
    expect(auditInsertCall).toEqual(
      expect.objectContaining({
        entityType: 'payout',
        entityId: 'payout-1',
        action: 'created',
        actorType: 'system',
      }),
    );
  });
});
