import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

// ── Mock fetch ──────────────────────────────────────────────────────

const mockFetch = mock(() => Promise.resolve(new Response()));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockClear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// Import after setting up mocks
const {
  searchEmails,
  getLatestEmail,
  waitForEmail,
  getEmailHtml,
  extractLinks,
  clearMailbox,
  isMailpitAvailable,
} = await import('@/lib/test-utils/mailpit');

// ── Test data ────────────────────────────────────────────────────────

const mockMessage = {
  ID: 'msg-001',
  MessageID: '<abc@example.com>',
  From: { Name: 'FuzzyCat', Address: 'noreply@fuzzycatapp.com' },
  To: [{ Name: 'Jane Doe', Address: 'jane@example.com' }],
  Subject: 'Password Reset',
  Snippet: 'Click here to reset...',
  Created: '2026-03-01T12:00:00Z',
  Size: 1024,
  Attachments: 0,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('searchEmails', () => {
  it('sends search query to Mailpit API', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ total: 1, unread: 0, count: 1, messages: [mockMessage] }),
    );

    const results = await searchEmails('to:jane@example.com');

    expect(results).toHaveLength(1);
    expect(results[0].Subject).toBe('Password Reset');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toContain('/api/v1/search');
    expect(calledUrl).toContain('query=to%3Ajane%40example.com');
  });

  it('returns empty array when no messages match', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ total: 0, unread: 0, count: 0, messages: [] }));

    const results = await searchEmails('to:nobody@example.com');
    expect(results).toHaveLength(0);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Server error', { status: 500 }));

    await expect(searchEmails('to:test@example.com')).rejects.toThrow(
      'Mailpit search failed (500)',
    );
  });
});

describe('getLatestEmail', () => {
  it('returns the first message from search results', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ total: 2, unread: 0, count: 2, messages: [mockMessage, mockMessage] }),
    );

    const result = await getLatestEmail('subject:Password');
    expect(result).not.toBeNull();
    expect(result?.ID).toBe('msg-001');
  });

  it('returns null when no messages found', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ total: 0, unread: 0, count: 0, messages: [] }));

    const result = await getLatestEmail('subject:nonexistent');
    expect(result).toBeNull();
  });
});

describe('waitForEmail', () => {
  it('returns immediately if email already exists', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ total: 1, unread: 0, count: 1, messages: [mockMessage] }),
    );

    const result = await waitForEmail({ to: 'jane@example.com', timeout: 2000 });
    expect(result.ID).toBe('msg-001');
  });

  it('polls until email arrives', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve(jsonResponse({ total: 0, unread: 0, count: 0, messages: [] }));
      }
      return Promise.resolve(
        jsonResponse({ total: 1, unread: 0, count: 1, messages: [mockMessage] }),
      );
    });

    const result = await waitForEmail({
      to: 'jane@example.com',
      timeout: 5000,
      pollInterval: 50,
    });
    expect(result.ID).toBe('msg-001');
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('throws after timeout if no email arrives', async () => {
    mockFetch.mockImplementation(() =>
      Promise.resolve(jsonResponse({ total: 0, unread: 0, count: 0, messages: [] })),
    );

    await expect(
      waitForEmail({ to: 'nobody@example.com', timeout: 200, pollInterval: 50 }),
    ).rejects.toThrow('No email matching');
  });

  it('throws if no search criteria provided', async () => {
    await expect(waitForEmail({})).rejects.toThrow('requires at least one of');
  });

  it('builds compound query from to + subject', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ total: 1, unread: 0, count: 1, messages: [mockMessage] }),
    );

    await waitForEmail({ to: 'jane@example.com', subject: 'reset' });

    const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toContain('to%3Ajane%40example.com');
    expect(calledUrl).toContain('subject%3Areset');
  });
});

describe('getEmailHtml', () => {
  it('fetches full message and returns HTML body', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        ID: 'msg-001',
        MessageID: '<abc@example.com>',
        From: mockMessage.From,
        To: mockMessage.To,
        Subject: 'Password Reset',
        HTML: '<h1>Reset your password</h1><a href="https://fuzzycatapp.com/reset?token=abc">Click here</a>',
        Text: 'Reset your password',
        Created: '2026-03-01T12:00:00Z',
      }),
    );

    const html = await getEmailHtml('msg-001');
    expect(html).toContain('<h1>Reset your password</h1>');
    expect(html).toContain('href="https://fuzzycatapp.com/reset?token=abc"');

    const calledUrl = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(calledUrl).toContain('/api/v1/message/msg-001');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Not found', { status: 404 }));

    await expect(getEmailHtml('bad-id')).rejects.toThrow('Mailpit message fetch failed (404)');
  });
});

describe('extractLinks', () => {
  it('extracts all href values from HTML', () => {
    const html = `
      <a href="https://example.com/reset?token=abc">Reset</a>
      <a href="https://example.com/support">Support</a>
      <a href="mailto:help@example.com">Email</a>
    `;

    const links = extractLinks(html);
    expect(links).toEqual([
      'https://example.com/reset?token=abc',
      'https://example.com/support',
      'mailto:help@example.com',
    ]);
  });

  it('returns empty array for HTML without links', () => {
    expect(extractLinks('<p>No links here</p>')).toEqual([]);
  });
});

describe('clearMailbox', () => {
  it('sends DELETE to messages endpoint', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await clearMailbox();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0] as unknown[];
    const calledUrl = callArgs[0] as string;
    const calledOpts = callArgs[1] as RequestInit;
    expect(calledUrl).toContain('/api/v1/messages');
    expect(calledOpts.method).toBe('DELETE');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Error', { status: 500 }));

    await expect(clearMailbox()).rejects.toThrow('Mailpit clear failed (500)');
  });
});

describe('isMailpitAvailable', () => {
  it('returns true when Mailpit responds OK', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ total: 0, unread: 0, count: 0, messages: [] }));

    const available = await isMailpitAvailable();
    expect(available).toBe(true);
  });

  it('returns false when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const available = await isMailpitAvailable();
    expect(available).toBe(false);
  });

  it('returns false on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const available = await isMailpitAvailable();
    expect(available).toBe(false);
  });
});
