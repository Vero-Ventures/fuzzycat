/**
 * Mailpit REST API client for E2E email testing.
 *
 * Mailpit is bundled with the Supabase CLI local dev stack and captures
 * all outgoing emails. Its REST API is available at http://localhost:54324
 * (the Supabase Inbucket port).
 *
 * @see https://mailpit.axllent.org/docs/api-v1/
 */

// Default Supabase CLI Mailpit URL. Override via setMailpitUrl() if needed.
let mailpitUrl = 'http://localhost:54324';

/** Override the Mailpit base URL (e.g. from env in test setup). */
export function setMailpitUrl(url: string): void {
  mailpitUrl = url;
}

function getMailpitUrl(): string {
  return mailpitUrl;
}

// ── Types ────────────────────────────────────────────────────────────

export interface MailpitAddress {
  Name: string;
  Address: string;
}

export interface MailpitMessage {
  ID: string;
  MessageID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  Snippet: string;
  Created: string;
  Size: number;
  Attachments: number;
}

interface MailpitSearchResponse {
  total: number;
  unread: number;
  count: number;
  messages: MailpitMessage[];
}

interface MailpitMessageDetail {
  ID: string;
  MessageID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  HTML: string;
  Text: string;
  Created: string;
}

// ── API helpers ──────────────────────────────────────────────────────

/**
 * Search emails using Mailpit's search query syntax.
 * Examples: `to:user@example.com`, `subject:password reset`, `is:unread`
 */
export async function searchEmails(query: string): Promise<MailpitMessage[]> {
  const url = new URL('/api/v1/search', getMailpitUrl());
  url.searchParams.set('query', query);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mailpit search failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as MailpitSearchResponse;
  return data.messages ?? [];
}

/**
 * Get the latest email matching a search query, or null if none found.
 */
export async function getLatestEmail(query: string): Promise<MailpitMessage | null> {
  const messages = await searchEmails(query);
  return messages.length > 0 ? messages[0] : null;
}

/**
 * Wait for an email matching criteria to arrive, with polling.
 * Throws if no matching email arrives before timeout.
 */
export async function waitForEmail(opts: {
  to?: string;
  subject?: string;
  timeout?: number;
  pollInterval?: number;
}): Promise<MailpitMessage> {
  const { to, subject, timeout = 10_000, pollInterval = 500 } = opts;

  const queryParts: string[] = [];
  if (to) queryParts.push(`to:${to}`);
  if (subject) queryParts.push(`subject:${subject}`);
  const query = queryParts.join(' ');

  if (!query) {
    throw new Error('waitForEmail requires at least one of: to, subject');
  }

  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const email = await getLatestEmail(query);
    if (email) return email;
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`No email matching "${query}" arrived within ${timeout}ms`);
}

/**
 * Get the full HTML body of an email by its ID.
 */
export async function getEmailHtml(id: string): Promise<string> {
  const url = new URL(`/api/v1/message/${id}`, getMailpitUrl());

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mailpit message fetch failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as MailpitMessageDetail;
  return data.HTML;
}

/**
 * Extract all href links from an HTML string.
 */
export function extractLinks(html: string): string[] {
  const matches = html.matchAll(/href="([^"]+)"/g);
  return [...matches].map((m) => m[1]);
}

/**
 * Delete all messages in the Mailpit inbox (cleanup between tests).
 */
export async function clearMailbox(): Promise<void> {
  const url = new URL('/api/v1/messages', getMailpitUrl());

  const res = await fetch(url.toString(), { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Mailpit clear failed (${res.status}): ${await res.text()}`);
  }
}

/**
 * Check if Mailpit is available at the configured URL.
 */
export async function isMailpitAvailable(): Promise<boolean> {
  try {
    const res = await fetch(new URL('/api/v1/messages', getMailpitUrl()).toString(), {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
