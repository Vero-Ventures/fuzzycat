import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mocks ────────────────────────────────────────────────────────────

const TEST_SECRET = 'test-sentry-webhook-secret';

const mockEnvValues: Record<string, string | undefined> = {
  SENTRY_WEBHOOK_SECRET: TEST_SECRET,
  GITHUB_TOKEN: 'ghp_test_token',
  GITHUB_REPO: 'fuzzycatapp/fuzzycat',
};

mock.module('@/lib/env', () => ({
  serverEnv: () => mockEnvValues,
}));

const mockLogger = {
  info: mock(),
  warn: mock(),
  error: mock(),
};

mock.module('@/lib/logger', () => ({
  logger: mockLogger,
}));

const { POST } = await import('@/app/api/webhooks/sentry/route');

/** Compute HMAC-SHA256 hex digest matching Sentry's signing. */
async function sign(body: string, secret: string = TEST_SECRET): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface GitHubIssueBody {
  title: string;
  body: string;
  labels: string[];
}

function buildIssuePayload(overrides?: { action?: string; level?: string; title?: string }) {
  return {
    action: overrides?.action ?? 'created',
    data: {
      issue: {
        id: '12345',
        title: overrides?.title ?? 'TypeError: Cannot read property of undefined',
        culprit: 'app/components/Dashboard.tsx',
        level: overrides?.level ?? 'error',
        count: 42,
        permalink: 'https://fuzzycatapp.sentry.io/issues/12345/',
        metadata: {
          type: 'TypeError',
          value: "Cannot read property 'id' of undefined",
          filename: 'app/components/Dashboard.tsx',
        },
      },
    },
  };
}

function buildFeedbackPayload(overrides?: { action?: string; message?: string }) {
  return {
    action: overrides?.action ?? 'triggered',
    data: {
      event: {
        title: 'User Feedback',
        event_id: 'evt-abc-123',
        web_url: 'https://fuzzycatapp.sentry.io/issues/99/',
        user: { email: 'owner@example.com' },
        contexts: {
          feedback: {
            message: overrides?.message ?? 'The payment page is broken after I click submit',
            contact_email: 'owner@example.com',
            name: 'Jane Doe',
          },
        },
      },
    },
  };
}

async function makeRequest(body: string, resource: string, signature?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'sentry-hook-resource': resource,
  };
  if (signature) {
    headers['sentry-hook-signature'] = signature;
  }

  return POST(
    new Request('http://localhost/api/webhooks/sentry', {
      method: 'POST',
      headers,
      body,
    }),
  );
}

function mockFetchForGitHub(
  originalFetch: typeof globalThis.fetch,
  onGitHub: (body: GitHubIssueBody) => void,
) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('api.github.com')) {
      onGitHub(JSON.parse(init?.body as string) as GitHubIssueBody);
      return new Response(JSON.stringify({ number: 1, html_url: 'https://github.com/test/1' }), {
        status: 201,
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('POST /api/webhooks/sentry', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockEnvValues.SENTRY_WEBHOOK_SECRET = TEST_SECRET;
    mockEnvValues.GITHUB_TOKEN = 'ghp_test_token';
    mockEnvValues.GITHUB_REPO = 'fuzzycatapp/fuzzycat';
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    mockEnvValues.SENTRY_WEBHOOK_SECRET = undefined;
    mockEnvValues.GITHUB_TOKEN = undefined;
    mockEnvValues.GITHUB_REPO = undefined;
    globalThis.fetch = originalFetch;
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  it('returns 400 when signature is missing', async () => {
    const body = JSON.stringify(buildIssuePayload());
    const response = await makeRequest(body, 'issue');

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Signature missing');
  });

  it('returns 400 when signature is invalid', async () => {
    const body = JSON.stringify(buildIssuePayload());
    const response = await makeRequest(body, 'issue', 'invalid-signature-hex');

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid signature');
  });

  it('returns 200 and creates GitHub issue for error-level issue', async () => {
    const payload = buildIssuePayload({ level: 'error' });
    const body = JSON.stringify(payload);
    const sig = await sign(body);

    let createdIssue: GitHubIssueBody | null = null;
    mockFetchForGitHub(originalFetch, (issue) => {
      createdIssue = issue;
    });

    const response = await makeRequest(body, 'issue', sig);

    expect(response.status).toBe(200);
    expect(createdIssue).not.toBeNull();
    const issue = createdIssue as unknown as GitHubIssueBody;
    expect(issue.title).toBe('[sentry] TypeError: Cannot read property of undefined');
    expect(issue.labels).toContain('bug');
    expect(issue.labels).toContain('sentry');
    expect(issue.labels).toContain('severity:error');
  });

  it('skips GitHub issue for warning-level issue', async () => {
    const payload = buildIssuePayload({ level: 'warning' });
    const body = JSON.stringify(payload);
    const sig = await sign(body);

    let githubCalled = false;
    mockFetchForGitHub(originalFetch, () => {
      githubCalled = true;
    });

    const response = await makeRequest(body, 'issue', sig);

    expect(response.status).toBe(200);
    expect(githubCalled).toBe(false);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Sentry issue skipped (non-critical)',
      expect.objectContaining({ level: 'warning' }),
    );
  });

  it('returns 200 when env vars not configured (graceful degradation)', async () => {
    mockEnvValues.SENTRY_WEBHOOK_SECRET = undefined;

    const body = JSON.stringify(buildIssuePayload());
    const response = await makeRequest(body, 'issue');

    expect(response.status).toBe(200);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Sentry webhook received but SENTRY_WEBHOOK_SECRET not configured',
    );
  });

  it('returns 200 on GitHub API failure (handler error tolerance)', async () => {
    const payload = buildIssuePayload({ level: 'fatal' });
    const body = JSON.stringify(payload);
    const sig = await sign(body);

    globalThis.fetch = (async () => {
      return new Response('Internal Server Error', { status: 500 });
    }) as unknown as typeof fetch;

    const response = await makeRequest(body, 'issue', sig);

    expect(response.status).toBe(200);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Sentry webhook handler error',
      expect.objectContaining({ resource: 'issue' }),
    );
  });

  it('handles installation verification ping', async () => {
    const body = JSON.stringify({ action: 'created', installation: { uuid: 'test' } });
    const sig = await sign(body);

    const response = await makeRequest(body, 'installation', sig);

    expect(response.status).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Sentry webhook: installation verification received',
    );
  });

  it('creates feedback GitHub issue from event_alert', async () => {
    const payload = buildFeedbackPayload();
    const body = JSON.stringify(payload);
    const sig = await sign(body);

    let createdIssue: GitHubIssueBody | null = null;
    mockFetchForGitHub(originalFetch, (issue) => {
      createdIssue = issue;
    });

    const response = await makeRequest(body, 'event_alert', sig);

    expect(response.status).toBe(200);
    expect(createdIssue).not.toBeNull();
    const issue = createdIssue as unknown as GitHubIssueBody;
    expect(issue.title).toStartWith('[feedback]');
    expect(issue.labels).toContain('feedback');
    expect(issue.labels).toContain('user-reported');
    expect(issue.body).toContain('The payment page is broken');
  });
});
