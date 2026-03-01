import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockInsertValues = mock(() => Promise.resolve());
const mockInsert = mock(() => ({ values: mockInsertValues }));

mock.module('@/server/db', () => ({
  db: { insert: mockInsert },
}));

mock.module('@/server/db/schema', () => ({
  owners: { __table: 'owners' },
  clinics: { __table: 'clinics' },
  pets: { id: 'pets.id', ownerId: 'pets.owner_id' },
  petsRelations: {},
}));

const mockSignUp = mock();
const mockUpdateUserById = mock();
const mockDeleteUser = mock();

mock.module('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { signUp: mockSignUp },
    }),
}));

mock.module('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
        deleteUser: mockDeleteUser,
      },
    },
  }),
}));

mock.module('@/lib/rate-limit', () => ({
  checkRateLimit: () => Promise.resolve({ success: true }),
}));

const mockVerifyCaptcha = mock(() => Promise.resolve(true));
mock.module('@/lib/captcha', () => ({
  verifyCaptcha: mockVerifyCaptcha,
}));

const mockServerEnv = mock(
  () => ({ TURNSTILE_SECRET_KEY: '' }) as Record<string, string | undefined>,
);
mock.module('@/lib/env', () => ({
  serverEnv: mockServerEnv,
  _resetEnvCache: () => {},
}));

const mockCapture = mock();
mock.module('@/lib/posthog/server', () => ({
  getPostHogServer: () => ({ capture: mockCapture }),
}));

mock.module('@/lib/posthog/events', () => ({
  POSTHOG_EVENTS: {
    AUTH_SIGNED_UP: 'auth_signed_up',
    CLINIC_REGISTERED: 'clinic_registered',
  },
}));

mock.module('@/lib/logger', () => ({
  logger: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

const mockCaptureException = mock();
mock.module('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}));

// Import AFTER all mocks are set up
const { signUpOwner, signUpClinic } = await import('@/app/(auth)/signup/actions');

// ── Helpers ──────────────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeOwnerFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('email', 'owner@example.com');
  fd.set('password', 'securePassword123');
  fd.set('name', 'Jane Doe');
  fd.set('phone', '555-123-4567');
  fd.set('petName', 'Whiskers');
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

function makeClinicFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set('email', 'clinic@example.com');
  fd.set('password', 'securePassword123');
  fd.set('clinicName', 'Happy Paws Vet');
  fd.set('phone', '555-987-6543');
  fd.set('addressState', 'CA');
  fd.set('addressZip', '90210');
  for (const [k, v] of Object.entries(overrides)) {
    fd.set(k, v);
  }
  return fd;
}

function setupSuccessfulAuth() {
  mockSignUp.mockResolvedValue({
    data: {
      user: { id: USER_ID, identities: [{ id: '1' }] },
      session: { access_token: 'token' },
    },
    error: null,
  });
  mockUpdateUserById.mockResolvedValue({ error: null });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('signUpOwner', () => {
  beforeEach(() => {
    mock.restore();
    setupSuccessfulAuth();
    mockInsertValues.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockSignUp.mockReset();
    mockUpdateUserById.mockReset();
    mockDeleteUser.mockReset();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
    mockCapture.mockClear();
  });

  it('creates owner successfully', async () => {
    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBeNull();
    expect(result.needsEmailConfirmation).toBe(false);
  });

  it('returns duplicate email error for PostgreSQL 23505 code', async () => {
    const pgError = new Error(
      'duplicate key value violates unique constraint "owners_email_unique"',
    );
    (pgError as unknown as { code: string }).code = '23505';
    mockInsertValues.mockRejectedValue(pgError);

    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns duplicate email error when error message contains "duplicate key"', async () => {
    mockInsertValues.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns duplicate email error when error message contains "unique"', async () => {
    mockInsertValues.mockRejectedValue(new Error('unique constraint violated on email'));

    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns generic error for non-unique DB failures', async () => {
    mockInsertValues.mockRejectedValue(new Error('connection refused'));

    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBe(
      'Account setup failed due to a database error. Please try again or contact support. (REF: DB-OWNER)',
    );
  });

  it('deletes auth user on DB insert failure', async () => {
    mockInsertValues.mockRejectedValue(new Error('connection refused'));

    await signUpOwner(makeOwnerFormData());
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('returns duplicate email when Supabase returns empty identities', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: USER_ID, identities: [] },
        session: null,
      },
      error: null,
    });

    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns validation error for invalid email', async () => {
    const result = await signUpOwner(makeOwnerFormData({ email: 'not-an-email' }));
    expect(result.error).toContain('Invalid email');
  });

  it('calls Sentry.captureException on DB insert failure', async () => {
    const dbError = new Error('connection refused');
    mockInsertValues.mockRejectedValue(dbError);

    await signUpOwner(makeOwnerFormData());
    expect(mockCaptureException).toHaveBeenCalledWith(dbError, {
      tags: { component: 'signup', step: 'db_insert', role: 'owner' },
      extra: { userId: USER_ID, email: 'owner@example.com' },
    });
  });
});

describe('signUpClinic', () => {
  beforeEach(() => {
    mock.restore();
    setupSuccessfulAuth();
    mockInsertValues.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockSignUp.mockReset();
    mockUpdateUserById.mockReset();
    mockDeleteUser.mockReset();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
    mockCapture.mockClear();
  });

  it('creates clinic successfully', async () => {
    const result = await signUpClinic(makeClinicFormData());
    expect(result.error).toBeNull();
    expect(result.needsEmailConfirmation).toBe(false);
  });

  it('returns duplicate email error for PostgreSQL 23505 code', async () => {
    const pgError = new Error(
      'duplicate key value violates unique constraint "clinics_email_unique"',
    );
    (pgError as unknown as { code: string }).code = '23505';
    mockInsertValues.mockRejectedValue(pgError);

    const result = await signUpClinic(makeClinicFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns duplicate email error when error message contains "duplicate key"', async () => {
    mockInsertValues.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    const result = await signUpClinic(makeClinicFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns generic error for non-unique DB failures', async () => {
    mockInsertValues.mockRejectedValue(new Error('timeout'));

    const result = await signUpClinic(makeClinicFormData());
    expect(result.error).toBe(
      'Account setup failed due to a database error. Please try again or contact support. (REF: DB-CLINIC)',
    );
  });

  it('deletes auth user on DB insert failure', async () => {
    mockInsertValues.mockRejectedValue(new Error('timeout'));

    await signUpClinic(makeClinicFormData());
    expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('returns duplicate email when Supabase returns empty identities', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: USER_ID, identities: [] },
        session: null,
      },
      error: null,
    });

    const result = await signUpClinic(makeClinicFormData());
    expect(result.error).toBe('An account with this email already exists. Please log in instead.');
  });

  it('returns validation error for invalid state code', async () => {
    const result = await signUpClinic(makeClinicFormData({ addressState: 'California' }));
    expect(result.error).toContain('State must be a 2-letter code');
  });

  it('calls Sentry.captureException on DB insert failure', async () => {
    const dbError = new Error('timeout');
    mockInsertValues.mockRejectedValue(dbError);

    await signUpClinic(makeClinicFormData());
    expect(mockCaptureException).toHaveBeenCalledWith(dbError, {
      tags: { component: 'signup', step: 'db_insert', role: 'clinic' },
      extra: { userId: USER_ID, email: 'clinic@example.com' },
    });
  });
});

describe('validateCaptcha (DISABLE_CAPTCHA flag)', () => {
  beforeEach(() => {
    mock.restore();
    setupSuccessfulAuth();
    mockInsertValues.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
  });

  afterEach(() => {
    mockSignUp.mockReset();
    mockUpdateUserById.mockReset();
    mockDeleteUser.mockReset();
    mockInsert.mockClear();
    mockInsertValues.mockClear();
    mockCapture.mockClear();
    mockVerifyCaptcha.mockClear();
    mockCaptureException.mockClear();
  });

  it('bypasses CAPTCHA when DISABLE_CAPTCHA=true even with TURNSTILE_SECRET_KEY set', async () => {
    mockServerEnv.mockReturnValue({ TURNSTILE_SECRET_KEY: 'real-key', DISABLE_CAPTCHA: 'true' });

    const result = await signUpOwner(makeOwnerFormData());
    expect(result.error).toBeNull();
    expect(mockVerifyCaptcha).not.toHaveBeenCalled();
  });
});
