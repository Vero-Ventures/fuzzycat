import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const mockDecodeProtectedHeader = mock();
const mockImportJWK = mock();
const mockJwtVerify = mock();

mock.module('jose', () => ({
  decodeProtectedHeader: mockDecodeProtectedHeader,
  importJWK: mockImportJWK,
  jwtVerify: mockJwtVerify,
}));

const mockWebhookVerificationKeyGet = mock();

mock.module('@/lib/plaid', () => ({
  plaid: () => ({
    webhookVerificationKeyGet: mockWebhookVerificationKeyGet,
  }),
}));

const mockDbUpdate = mock();
const mockDbSelect = mock();

mock.module('@/server/db', () => ({
  db: {
    update: mockDbUpdate,
    select: mockDbSelect,
  },
}));

const mockLogAuditEvent = mock();

mock.module('@/server/services/audit', () => ({
  logAuditEvent: mockLogAuditEvent,
}));

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
};

mock.module('@/lib/logger', () => ({
  logger: mockLogger,
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => args,
}));

mock.module('@/server/db/schema', () => ({
  owners: {
    id: 'id',
    plaidItemId: 'plaidItemId',
    plaidAccessToken: 'plaidAccessToken',
  },
  pets: { id: 'pets.id', ownerId: 'pets.owner_id' },
  petsRelations: {},
}));

const { POST } = await import('@/app/api/webhooks/plaid/route');

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a valid webhook body and matching SHA-256 hash. */
async function buildVerifiedBody(body: object): Promise<{ bodyStr: string; hash: string }> {
  const bodyStr = JSON.stringify(body);
  const encoder = new TextEncoder();
  const data = encoder.encode(bodyStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hash = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { bodyStr, hash };
}

function setupVerificationMocks(hash: string) {
  mockDecodeProtectedHeader.mockReturnValue({ kid: 'key-123' });
  mockWebhookVerificationKeyGet.mockResolvedValue({
    data: { key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } },
  });
  mockImportJWK.mockResolvedValue('mock-public-key');
  mockJwtVerify.mockResolvedValue({
    payload: { request_body_sha256: hash },
  });
}

function setupOwnerLookup(owner: { id: string } | undefined) {
  if (owner) {
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([owner]),
        }),
      }),
    });
  } else {
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
  }
}

function setupDbUpdate() {
  mockDbUpdate.mockReturnValue({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/webhooks/plaid', () => {
  beforeEach(() => {
    mockLogAuditEvent.mockResolvedValue(undefined);
    setupDbUpdate();
  });

  afterEach(() => {
    mockDecodeProtectedHeader.mockClear();
    mockImportJWK.mockClear();
    mockJwtVerify.mockClear();
    mockWebhookVerificationKeyGet.mockClear();
    mockDbUpdate.mockClear();
    mockDbSelect.mockClear();
    mockLogAuditEvent.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  it('returns 400 when plaid-verification header is missing', async () => {
    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      body: '{}',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Webhook verification failed');
  });

  it('returns 400 when JWT has no kid', async () => {
    mockDecodeProtectedHeader.mockReturnValue({});

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: '{}',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when JWT verification fails', async () => {
    mockDecodeProtectedHeader.mockReturnValue({ kid: 'key-123' });
    mockWebhookVerificationKeyGet.mockResolvedValue({
      data: { key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } },
    });
    mockImportJWK.mockResolvedValue('mock-public-key');
    mockJwtVerify.mockRejectedValue(new Error('Invalid signature'));

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: '{}',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when body hash mismatch', async () => {
    mockDecodeProtectedHeader.mockReturnValue({ kid: 'key-123' });
    mockWebhookVerificationKeyGet.mockResolvedValue({
      data: { key: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } },
    });
    mockImportJWK.mockResolvedValue('mock-public-key');
    mockJwtVerify.mockResolvedValue({
      payload: { request_body_sha256: 'wrong-hash' },
    });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: '{"webhook_type":"ITEM"}',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('returns 400 when body is invalid JSON (after verification passes)', async () => {
    const invalidBody = 'not-valid-json{{{';
    const encoder = new TextEncoder();
    const data = encoder.encode(invalidBody);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hash = Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    setupVerificationMocks(hash);

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: invalidBody,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid JSON');
  });

  it('200 ITEM/ERROR: owner found, audit logged with bankStatus: error', async () => {
    const webhook = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-abc',
      environment: 'sandbox',
      error: {
        error_type: 'ITEM_ERROR',
        error_code: 'ITEM_LOGIN_REQUIRED',
        error_message: 'login required',
      },
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup({ id: 'owner-1' });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'owner',
        entityId: 'owner-1',
        action: 'status_changed',
        newValue: expect.objectContaining({ bankStatus: 'error' }),
      }),
    );
  });

  it('200 ITEM/PENDING_EXPIRATION: audit logged with bankStatus: pending_expiration', async () => {
    const webhook = {
      webhook_type: 'ITEM',
      webhook_code: 'PENDING_EXPIRATION',
      item_id: 'item-abc',
      environment: 'sandbox',
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup({ id: 'owner-1' });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { bankStatus: 'pending_expiration' },
      }),
    );
  });

  it('200 ITEM/USER_PERMISSION_REVOKED: tokens cleared, audit logged with bankStatus: revoked', async () => {
    const webhook = {
      webhook_type: 'ITEM',
      webhook_code: 'USER_PERMISSION_REVOKED',
      item_id: 'item-abc',
      environment: 'sandbox',
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup({ id: 'owner-1' });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockDbUpdate).toHaveBeenCalled();
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { bankStatus: 'revoked' },
      }),
    );
  });

  it('200 ITEM webhook: no owner found, warning logged, no DB write', async () => {
    const webhook = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-unknown',
      environment: 'sandbox',
      error: { error_type: 'ITEM_ERROR', error_code: 'ITEM_LOGIN_REQUIRED', error_message: 'err' },
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup(undefined);

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Plaid ITEM webhook: no owner found for item',
      expect.objectContaining({ itemId: 'item-unknown' }),
    );
    expect(mockLogAuditEvent).not.toHaveBeenCalled();
  });

  it('200 AUTH/AUTOMATICALLY_VERIFIED: audit logged with authStatus: verified', async () => {
    const webhook = {
      webhook_type: 'AUTH',
      webhook_code: 'AUTOMATICALLY_VERIFIED',
      item_id: 'item-abc',
      environment: 'sandbox',
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup({ id: 'owner-1' });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'owner',
        entityId: 'owner-1',
        newValue: { authStatus: 'verified' },
      }),
    );
  });

  it('200 AUTH/VERIFICATION_EXPIRED: audit logged with authStatus: expired', async () => {
    const webhook = {
      webhook_type: 'AUTH',
      webhook_code: 'VERIFICATION_EXPIRED',
      item_id: 'item-abc',
      environment: 'sandbox',
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup({ id: 'owner-1' });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockLogAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        newValue: { authStatus: 'expired' },
      }),
    );
  });

  it('200 AUTH unhandled code: info logged', async () => {
    const webhook = {
      webhook_type: 'AUTH',
      webhook_code: 'DEFAULT_UPDATE',
      item_id: 'item-abc',
      environment: 'sandbox',
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);
    setupOwnerLookup({ id: 'owner-1' });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Plaid AUTH webhook: unhandled code',
      expect.objectContaining({ webhookCode: 'DEFAULT_UPDATE' }),
    );
  });

  it('200 unknown webhook_type: info logged', async () => {
    const webhook = {
      webhook_type: 'TRANSACTIONS',
      webhook_code: 'INITIAL_UPDATE',
      item_id: 'item-abc',
      environment: 'sandbox',
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Plaid webhook: unhandled type',
      expect.objectContaining({ webhook_type: 'TRANSACTIONS' }),
    );
  });

  it('returns 500 when handler throws (DB error)', async () => {
    const webhook = {
      webhook_type: 'ITEM',
      webhook_code: 'ERROR',
      item_id: 'item-abc',
      environment: 'sandbox',
      error: { error_type: 'ITEM_ERROR', error_code: 'CODE', error_message: 'msg' },
    };
    const { bodyStr, hash } = await buildVerifiedBody(webhook);
    setupVerificationMocks(hash);

    // Make the DB select throw
    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.reject(new Error('Connection reset')),
        }),
      }),
    });

    const request = new Request('http://localhost/api/webhooks/plaid', {
      method: 'POST',
      headers: { 'plaid-verification': 'mock-jwt' },
      body: bodyStr,
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Webhook handler error');
  });
});
