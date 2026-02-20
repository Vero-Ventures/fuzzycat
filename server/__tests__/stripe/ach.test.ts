import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockPaymentIntentsCreate = mock(() =>
  Promise.resolve({
    id: 'pi_ach_789',
    client_secret: 'pi_ach_789_secret_abc',
    status: 'requires_confirmation',
  }),
);

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    paymentIntents: { create: mockPaymentIntentsCreate },
  }),
}));

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();
const mockInsertValues = mock();
const mockInsert = mock();

mock.module('@/server/db', () => ({
  db: {
    update: mockUpdate,
    insert: mockInsert,
  },
}));

import { schemaMock } from './_mock-schema';

mock.module('@/server/db/schema', () => schemaMock);

const { createInstallmentPaymentIntent } = await import('@/server/services/stripe/ach');

// ── Tests ────────────────────────────────────────────────────────────

describe('createInstallmentPaymentIntent', () => {
  const defaultParams = {
    paymentId: 'pay-2',
    planId: 'plan-1',
    stripeCustomerId: 'cus_123',
    amountCents: 15_900,
  };

  beforeEach(() => {
    mockUpdateWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    mockInsertValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockInsertValues });

    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_ach_789',
      client_secret: 'pi_ach_789_secret_abc',
      status: 'requires_confirmation',
    });
  });

  afterEach(() => {
    mockPaymentIntentsCreate.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
  });

  it('creates a PaymentIntent with correct ACH params', async () => {
    const result = await createInstallmentPaymentIntent(defaultParams);

    expect(result.paymentIntentId).toBe('pi_ach_789');
    expect(result.clientSecret).toBe('pi_ach_789_secret_abc');

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15_900,
        currency: 'usd',
        customer: 'cus_123',
        payment_method_types: ['us_bank_account'],
        metadata: { paymentId: 'pay-2', planId: 'plan-1' },
      }),
    );
  });

  it('confirms immediately when payment method is provided', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_ach_confirmed',
      client_secret: 'pi_ach_confirmed_secret',
      status: 'processing',
    });

    const result = await createInstallmentPaymentIntent({
      ...defaultParams,
      paymentMethodId: 'pm_bank_123',
    });

    expect(result.status).toBe('processing');
    const callArgs = (
      mockPaymentIntentsCreate.mock.calls[0] as unknown as [Record<string, unknown>]
    )[0];
    expect(callArgs.payment_method).toBe('pm_bank_123');
    expect(callArgs.confirm).toBe(true);
  });

  it('does not confirm when no payment method provided', async () => {
    await createInstallmentPaymentIntent(defaultParams);

    const callArgs = (
      mockPaymentIntentsCreate.mock.calls[0] as unknown as [Record<string, unknown>]
    )[0];
    expect(callArgs.payment_method).toBeUndefined();
    expect(callArgs.confirm).toBeUndefined();
  });

  it('updates payment record with processing status', async () => {
    await createInstallmentPaymentIntent(defaultParams);

    expect(mockUpdateSet).toHaveBeenCalledWith({
      status: 'processing',
      stripePaymentIntentId: 'pi_ach_789',
    });
  });

  it('creates an audit log entry', async () => {
    await createInstallmentPaymentIntent(defaultParams);

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-2',
        action: 'status_changed',
        actorType: 'system',
      }),
    );
  });
});
