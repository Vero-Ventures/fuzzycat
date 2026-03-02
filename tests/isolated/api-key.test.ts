import { beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockInsertValues = mock();
const mockInsertReturning = mock();
const mockInsert = mock();

const mockSelectFrom = mock();
const mockSelectWhere = mock();
const mockSelectLimit = mock();
const mockSelect = mock();

const mockUpdateSet = mock();
const mockUpdateWhere = mock();
const mockUpdateReturning = mock();
const mockUpdate = mock();

mock.module('@/server/db', () => ({
  db: {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
  },
}));

mock.module('@/server/db/schema', () => ({
  apiKeys: {
    id: 'api_keys.id',
    clinicId: 'api_keys.clinic_id',
    name: 'api_keys.name',
    keyHash: 'api_keys.key_hash',
    keyPrefix: 'api_keys.key_prefix',
    permissions: 'api_keys.permissions',
    lastUsedAt: 'api_keys.last_used_at',
    expiresAt: 'api_keys.expires_at',
    allowedIps: 'api_keys.allowed_ips',
    createdAt: 'api_keys.created_at',
    revokedAt: 'api_keys.revoked_at',
  },
  clinics: { id: 'clinics.id' },
  auditLog: { id: 'auditLog.id' },
}));

mock.module('@/server/services/audit', () => ({
  logAuditEvent: mock(() => Promise.resolve()),
}));

mock.module('@/lib/logger', () => ({
  logger: { info: mock(), warn: mock(), error: mock() },
}));

// Import after mocks
const { generateApiKey, validateApiKey, revokeApiKey, listApiKeys } = await import(
  '@/server/services/api-key'
);

// ── Test data ────────────────────────────────────────────────────────

const CLINIC_ID = '11111111-1111-1111-1111-111111111111';
const API_KEY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ACTOR_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

// ── Helpers ──────────────────────────────────────────────────────────

function setupInsertChain(returnValue: unknown) {
  mockInsertReturning.mockReturnValue(Promise.resolve(returnValue));
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
  mockInsert.mockReturnValue({ values: mockInsertValues });
}

function setupSelectChain(returnValue: unknown) {
  mockSelectLimit.mockReturnValue(Promise.resolve(returnValue));
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function setupUpdateChain(returnValue: unknown) {
  mockUpdateReturning.mockReturnValue(Promise.resolve(returnValue));
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  // Only reset individual mocks — do NOT call mock.restore() here because
  // it undoes mock.module() registrations, causing cross-contamination
  // when tests run together in CI.
  mockInsertReturning.mockReset();
  mockInsertValues.mockReset();
  mockInsert.mockReset();
  mockSelectFrom.mockReset();
  mockSelectWhere.mockReset();
  mockSelectLimit.mockReset();
  mockSelect.mockReset();
  mockUpdateSet.mockReset();
  mockUpdateWhere.mockReset();
  mockUpdateReturning.mockReset();
  mockUpdate.mockReset();
});

describe('generateApiKey', () => {
  it('returns a key with fc_live_ prefix and correct structure', async () => {
    setupInsertChain([{ id: API_KEY_ID }]);

    const result = await generateApiKey(CLINIC_ID, 'Test Key', ['enrollments:read'], ACTOR_ID);

    expect(result.id).toBe(API_KEY_ID);
    expect(result.plaintextKey).toMatch(/^fc_live_[a-f0-9]{32}$/);
    expect(result.keyPrefix).toHaveLength(12);
    expect(result.keyPrefix).toBe(result.plaintextKey.slice(0, 12));
  });

  it('generates unique keys on each call', async () => {
    setupInsertChain([{ id: API_KEY_ID }]);
    const result1 = await generateApiKey(CLINIC_ID, 'Key 1', ['enrollments:read']);

    setupInsertChain([{ id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' }]);
    const result2 = await generateApiKey(CLINIC_ID, 'Key 2', ['enrollments:read']);

    expect(result1.plaintextKey).not.toBe(result2.plaintextKey);
  });

  it('rejects invalid permissions', async () => {
    await expect(generateApiKey(CLINIC_ID, 'Bad Key', ['invalid:scope'])).rejects.toThrow(
      'Invalid permissions',
    );
  });

  it('accepts all valid permission scopes', async () => {
    setupInsertChain([{ id: API_KEY_ID }]);

    const allPerms = [
      'enrollments:read',
      'enrollments:write',
      'clinic:read',
      'clinic:write',
      'clients:read',
      'export:read',
      'payouts:read',
    ];

    const result = await generateApiKey(CLINIC_ID, 'Full Access', allPerms, ACTOR_ID);
    expect(result.id).toBe(API_KEY_ID);
  });

  it('stores the SHA-256 hash, not the plaintext key', async () => {
    setupInsertChain([{ id: API_KEY_ID }]);

    const result = await generateApiKey(CLINIC_ID, 'Test', ['enrollments:read']);

    // The values call should have been made with a hash, not the plaintext
    const insertCall = mockInsertValues.mock.calls[0];
    const values = insertCall[0];
    expect(values.keyHash).not.toBe(result.plaintextKey);
    expect(values.keyHash).toHaveLength(64); // SHA-256 hex is 64 chars
  });
});

describe('validateApiKey', () => {
  it('returns null for keys without fc_live_ prefix', async () => {
    const result = await validateApiKey('invalid_key');
    expect(result).toBeNull();
  });

  it('returns null when key not found in database', async () => {
    setupSelectChain([]);

    const result = await validateApiKey('fc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1');
    expect(result).toBeNull();
  });

  it('returns clinic ID and permissions for valid key', async () => {
    setupSelectChain([
      {
        id: API_KEY_ID,
        clinicId: CLINIC_ID,
        permissions: ['enrollments:read', 'clinic:read'],
        revokedAt: null,
        expiresAt: null,
        allowedIps: null,
      },
    ]);

    // The fire-and-forget update needs a thenable at the end of the chain
    const thenable = Object.assign(Promise.resolve(), { catch: mock() });
    mockUpdateWhere.mockReturnValue(thenable);
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });

    const result = await validateApiKey('fc_live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1');

    expect(result).not.toBeNull();
    expect(result?.clinicId).toBe(CLINIC_ID);
    expect(result?.permissions).toEqual(['enrollments:read', 'clinic:read']);
  });
});

describe('revokeApiKey', () => {
  it('returns true when key is successfully revoked', async () => {
    setupUpdateChain([{ id: API_KEY_ID }]);

    const result = await revokeApiKey(API_KEY_ID, CLINIC_ID, ACTOR_ID);
    expect(result).toBe(true);
  });

  it('returns false when key not found or already revoked', async () => {
    setupUpdateChain([]);

    const result = await revokeApiKey(API_KEY_ID, CLINIC_ID);
    expect(result).toBe(false);
  });
});

describe('listApiKeys', () => {
  it('returns all keys for a clinic', async () => {
    const keys = [
      {
        id: API_KEY_ID,
        name: 'Key 1',
        keyPrefix: 'fc_live_a1b2',
        permissions: ['enrollments:read'],
        lastUsedAt: null,
        createdAt: new Date(),
        revokedAt: null,
      },
    ];

    mockSelectWhere.mockReturnValue(Promise.resolve(keys));
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });

    const result = await listApiKeys(CLINIC_ID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Key 1');
  });

  it('returns empty array when clinic has no keys', async () => {
    mockSelectWhere.mockReturnValue(Promise.resolve([]));
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });

    const result = await listApiKeys(CLINIC_ID);
    expect(result).toHaveLength(0);
  });
});
