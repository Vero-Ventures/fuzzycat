import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelectLimit = mock();
const mockSelect = mock();

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdate = mock();

mock.module('@/server/db', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

mock.module('@/server/db/schema', () => ({
  clinics: {},
  clients: {
    id: 'clients.id',
    authId: 'clients.auth_id',
    stripeCustomerId: 'clients.stripe_customer_id',
    email: 'clients.email',
    name: 'clients.name',
  },
  paymentMethods: {},
  pets: {},
  plans: {},
  payments: {},
  payouts: {},
  riskPool: {},
  softCollections: {},
  apiKeys: {},
  auditLog: {},
  idempotencyKeys: {},
  webhookEndpoints: {},
  webhookDeliveries: {},
  clinicRequests: {},
  clinicReferrals: {},
  clientReferrals: {},
  knowledgeChunks: {},
  chatSessions: {},
  clinicStatusEnum: {},
  paymentMethodEnum: {},
  planStatusEnum: {},
  paymentTypeEnum: {},
  paymentStatusEnum: {},
  payoutStatusEnum: {},
  riskPoolTypeEnum: {},
  actorTypeEnum: {},
  softCollectionStageEnum: {},
  webhookDeliveryStatusEnum: {},
  referralStatusEnum: {},
  clinicsRelations: {},
  clientsRelations: {},
  paymentMethodsRelations: {},
  petsRelations: {},
  plansRelations: {},
  paymentsRelations: {},
  payoutsRelations: {},
  riskPoolRelations: {},
  softCollectionsRelations: {},
  apiKeysRelations: {},
  webhookEndpointsRelations: {},
  webhookDeliveriesRelations: {},
  clinicReferralsRelations: {},
  clientReferralsRelations: {},
}));

const mockCreateUser = mock();
const mockGenerateLink = mock();

mock.module('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        generateLink: mockGenerateLink,
      },
    },
  }),
}));

const mockGetOrCreateCustomer = mock();
mock.module('@/server/services/stripe/customer', () => ({
  getOrCreateCustomer: mockGetOrCreateCustomer,
}));

const mockSendEnrollmentInvite = mock();
mock.module('@/server/services/email', () => ({
  sendEnrollmentInvite: mockSendEnrollmentInvite,
}));

const mockLoggerInfo = mock();
const mockLoggerError = mock();
mock.module('@/lib/logger', () => ({
  logger: { info: mockLoggerInfo, warn: mock(), error: mockLoggerError },
}));

mock.module('@/lib/env', () => ({
  publicEnv: () => ({ NEXT_PUBLIC_APP_URL: 'https://test.fuzzycatapp.com' }),
}));

mock.module('drizzle-orm', () => ({
  eq: (col: string, val: string) => ({ col, val, type: 'eq' }),
}));

// Must be imported AFTER mocks
const { provisionClientAccount } = await import('@/server/services/client-provisioning');

// ── Test data ────────────────────────────────────────────────────────

const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const AUTH_ID = 'auth-uuid-1234';
const PLAN_ID = '33333333-3333-3333-3333-333333333333';
const RECOVERY_LINK = 'https://supabase.test/auth/v1/verify?token=abc123';

const SCHEDULE = {
  totalBillCents: 100000,
  feeCents: 6000,
  totalWithFeeCents: 106000,
  depositCents: 26500,
  remainingCents: 79500,
  installmentCents: 13250,
  numInstallments: 6,
  payments: [],
};

const BASE_PARAMS = {
  clientId: OWNER_ID,
  clientEmail: 'jane@example.com',
  clientName: 'Jane Doe',
  petName: 'Whiskers',
  planId: PLAN_ID,
  clinicName: 'Happy Paws Vet',
  schedule: SCHEDULE,
};

// ── Helpers ──────────────────────────────────────────────────────────

function setupDbSelect(authId: string | null) {
  mockSelectLimit.mockResolvedValue([{ authId }]);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function setupDbUpdate() {
  mockUpdateWhere.mockResolvedValue([]);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

function setupAuthCreateSuccess() {
  mockCreateUser.mockResolvedValue({
    data: { user: { id: AUTH_ID } },
    error: null,
  });
}

function setupAuthCreateError(message: string) {
  mockCreateUser.mockResolvedValue({
    data: { user: null },
    error: { message },
  });
}

function setupGenerateLinkSuccess() {
  mockGenerateLink.mockResolvedValue({
    data: { properties: { action_link: RECOVERY_LINK } },
    error: null,
  });
}

function setupGenerateLinkError(message: string) {
  mockGenerateLink.mockResolvedValue({
    data: null,
    error: { message },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('provisionClientAccount', () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockSelectFrom.mockReset();
    mockSelectWhere.mockReset();
    mockSelectLimit.mockReset();
    mockUpdate.mockReset();
    mockUpdateSet.mockReset();
    mockUpdateWhere.mockReset();
    mockCreateUser.mockReset();
    mockGenerateLink.mockReset();
    mockGetOrCreateCustomer.mockReset();
    mockSendEnrollmentInvite.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerError.mockReset();

    // Default: successful Stripe customer creation
    mockGetOrCreateCustomer.mockResolvedValue('cus_test123');
    // Default: successful email send
    mockSendEnrollmentInvite.mockResolvedValue({ success: true });
  });

  describe('new owner (no auth account)', () => {
    beforeEach(() => {
      setupDbSelect(null); // no authId
      setupDbUpdate();
    });

    it('creates Supabase auth account', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();

      await provisionClientAccount(BASE_PARAMS);

      expect(mockCreateUser).toHaveBeenCalledTimes(1);
      const call = mockCreateUser.mock.calls[0][0];
      expect(call.email).toBe('jane@example.com');
      expect(call.email_confirm).toBe(true);
      expect(call.app_metadata).toEqual({ role: 'client' });
      expect(typeof call.password).toBe('string');
      expect(call.password.length).toBeGreaterThan(0);
    });

    it('updates owners.authId after auth creation', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();

      await provisionClientAccount(BASE_PARAMS);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith({ authId: AUTH_ID });
    });

    it('generates recovery link with correct redirect URL', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();

      await provisionClientAccount(BASE_PARAMS);

      expect(mockGenerateLink).toHaveBeenCalledTimes(1);
      const call = mockGenerateLink.mock.calls[0][0];
      expect(call.type).toBe('recovery');
      expect(call.email).toBe('jane@example.com');
      expect(call.options.redirectTo).toContain('/reset-password');
      expect(call.options.redirectTo).toContain(
        encodeURIComponent(`/client/payments/${PLAN_ID}/deposit`),
      );
    });

    it('returns recovery link as setupUrl', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(RECOVERY_LINK);
    });

    it('sends enrollment invite email with correct props', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();

      await provisionClientAccount(BASE_PARAMS);

      expect(mockSendEnrollmentInvite).toHaveBeenCalledTimes(1);
      const [email, props] = mockSendEnrollmentInvite.mock.calls[0];
      expect(email).toBe('jane@example.com');
      expect(props.ownerName).toBe('Jane Doe');
      expect(props.petName).toBe('Whiskers');
      expect(props.clinicName).toBe('Happy Paws Vet');
      expect(props.totalBillCents).toBe(100000);
      expect(props.feeCents).toBe(6000);
      expect(props.depositCents).toBe(26500);
      expect(props.installmentCents).toBe(13250);
      expect(props.numInstallments).toBe(6);
      expect(props.setupUrl).toBe(RECOVERY_LINK);
    });

    it('calls getOrCreateCustomer with correct params', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();

      await provisionClientAccount(BASE_PARAMS);

      expect(mockGetOrCreateCustomer).toHaveBeenCalledWith({
        clientId: OWNER_ID,
        email: 'jane@example.com',
        name: 'Jane Doe',
      });
    });
  });

  describe('existing owner (has auth account)', () => {
    beforeEach(() => {
      setupDbSelect('existing-auth-id');
    });

    it('does NOT create Supabase auth account', async () => {
      await provisionClientAccount(BASE_PARAMS);

      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it('returns direct deposit URL as setupUrl', async () => {
      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(
        `https://test.fuzzycatapp.com/client/payments/${PLAN_ID}/deposit`,
      );
    });

    it('still creates Stripe customer', async () => {
      await provisionClientAccount(BASE_PARAMS);

      expect(mockGetOrCreateCustomer).toHaveBeenCalledTimes(1);
    });

    it('still sends enrollment invite email', async () => {
      await provisionClientAccount(BASE_PARAMS);

      expect(mockSendEnrollmentInvite).toHaveBeenCalledTimes(1);
      const [, props] = mockSendEnrollmentInvite.mock.calls[0];
      expect(props.setupUrl).toBe(
        `https://test.fuzzycatapp.com/client/payments/${PLAN_ID}/deposit`,
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      setupDbSelect(null);
      setupDbUpdate();
    });

    it('handles auth creation error gracefully (does not throw)', async () => {
      setupAuthCreateError('User already registered');

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(
        `https://test.fuzzycatapp.com/client/payments/${PLAN_ID}/deposit`,
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to create Supabase auth account for client',
        expect.objectContaining({ clientId: OWNER_ID }),
      );
      // Should NOT generate recovery link since auth failed
      expect(mockGenerateLink).not.toHaveBeenCalled();
      // Email should still be sent
      expect(mockSendEnrollmentInvite).toHaveBeenCalledTimes(1);
    });

    it('handles auth creation exception gracefully', async () => {
      mockCreateUser.mockRejectedValue(new Error('Network timeout'));

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(
        `https://test.fuzzycatapp.com/client/payments/${PLAN_ID}/deposit`,
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error creating auth account',
        expect.objectContaining({ error: 'Network timeout' }),
      );
    });

    it('handles Stripe customer creation failure gracefully', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();
      mockGetOrCreateCustomer.mockRejectedValue(new Error('Stripe API error'));

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(RECOVERY_LINK);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to create Stripe customer during provisioning',
        expect.objectContaining({ error: 'Stripe API error' }),
      );
      expect(mockSendEnrollmentInvite).toHaveBeenCalledTimes(1);
    });

    it('handles recovery link generation error gracefully', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkError('Rate limit exceeded');

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(
        `https://test.fuzzycatapp.com/client/payments/${PLAN_ID}/deposit`,
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to generate recovery link',
        expect.objectContaining({ clientId: OWNER_ID }),
      );
    });

    it('handles recovery link generation exception gracefully', async () => {
      setupAuthCreateSuccess();
      mockGenerateLink.mockRejectedValue(new Error('Connection refused'));

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(
        `https://test.fuzzycatapp.com/client/payments/${PLAN_ID}/deposit`,
      );
    });

    it('handles email sending failure gracefully', async () => {
      setupAuthCreateSuccess();
      setupGenerateLinkSuccess();
      mockSendEnrollmentInvite.mockRejectedValue(new Error('Resend API error'));

      const result = await provisionClientAccount(BASE_PARAMS);

      expect(result.setupUrl).toBe(RECOVERY_LINK);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Failed to send enrollment invite email',
        expect.objectContaining({ error: 'Resend API error' }),
      );
    });
  });
});
