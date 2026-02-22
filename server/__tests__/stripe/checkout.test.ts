import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockCheckoutSessionsCreate = mock(() =>
  Promise.resolve({
    id: 'cs_test_session_123',
    url: 'https://checkout.stripe.com/pay/cs_test_session_123',
    payment_intent: 'pi_deposit_456',
  }),
);

mock.module('@/lib/stripe', () => ({
  stripe: () => ({
    checkout: { sessions: { create: mockCheckoutSessionsCreate } },
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

import { createAuditMock } from '../audit-mock';

mock.module('@/server/services/audit', () => createAuditMock(mockInsert));

const { createDepositCheckoutSession } = await import('@/server/services/stripe/checkout');

// ── Tests ────────────────────────────────────────────────────────────

describe('createDepositCheckoutSession', () => {
  const defaultParams = {
    paymentId: 'pay-1',
    planId: 'plan-1',
    stripeCustomerId: 'cus_123',
    depositCents: 31_800,
    successUrl: 'https://app.example.com/success',
    cancelUrl: 'https://app.example.com/cancel',
  };

  beforeEach(() => {
    mockUpdateWhere.mockResolvedValue([]);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    mockInsertValues.mockResolvedValue([]);
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  afterEach(() => {
    mockCheckoutSessionsCreate.mockClear();
    mockUpdate.mockClear();
    mockUpdateSet.mockClear();
    mockUpdateWhere.mockClear();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
  });

  it('creates a Checkout session with correct params', async () => {
    const result = await createDepositCheckoutSession(defaultParams);

    expect(result.sessionId).toBe('cs_test_session_123');
    expect(result.sessionUrl).toBe('https://checkout.stripe.com/pay/cs_test_session_123');

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_method_types: ['card'],
        customer: 'cus_123',
        metadata: { paymentId: 'pay-1', planId: 'plan-1' },
        success_url: 'https://app.example.com/success',
        cancel_url: 'https://app.example.com/cancel',
      }),
    );

    // eslint-disable-next-line -- mock.calls is typed as empty tuple by default
    const callArgs = mockCheckoutSessionsCreate.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    const params = callArgs[0] as {
      line_items: { price_data: { unit_amount: number; currency: string } }[];
    };
    expect(params.line_items[0].price_data.unit_amount).toBe(31_800);
    expect(params.line_items[0].price_data.currency).toBe('usd');
  });

  it('updates payment record with payment intent ID and processing status', async () => {
    await createDepositCheckoutSession(defaultParams);

    expect(mockUpdateSet).toHaveBeenCalledWith({
      status: 'processing',
      stripePaymentIntentId: 'pi_deposit_456',
    });
  });

  it('creates an audit log entry', async () => {
    await createDepositCheckoutSession(defaultParams);

    // insert is called once for the audit log
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'payment',
        entityId: 'pay-1',
        action: 'status_changed',
        actorType: 'system',
      }),
    );
  });
});
