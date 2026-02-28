import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Sentry webhook handler.
 *
 * Receives events from a Sentry Internal Integration and creates GitHub issues
 * for critical errors and user feedback. Follows the same pattern as our Stripe
 * webhook: verify signature first, return 200 on handler errors to prevent
 * retry storms.
 *
 * Sentry sends three header values:
 * - `sentry-hook-resource`: "issue" | "event_alert" | "installation"
 * - `sentry-hook-signature`: HMAC-SHA256 hex digest of the body
 * - Content-Type: application/json
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('sentry-hook-signature');
  const resource = request.headers.get('sentry-hook-resource');

  // ── Signature verification ──────────────────────────────────────
  const { SENTRY_WEBHOOK_SECRET: secret, GITHUB_TOKEN, GITHUB_REPO } = serverEnv();
  if (!secret) {
    logger.warn('Sentry webhook received but SENTRY_WEBHOOK_SECRET not configured');
    return NextResponse.json({ received: true });
  }

  if (!signature) {
    logger.error('Sentry webhook signature missing');
    return NextResponse.json({ error: 'Signature missing' }, { status: 400 });
  }

  const isValid = await verifySignature(secret, body, signature);
  if (!isValid) {
    logger.error('Sentry webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── Route by resource type ──────────────────────────────────────
  try {
    switch (resource) {
      case 'installation':
        // Sentry sends this when configuring the webhook URL — just acknowledge
        logger.info('Sentry webhook: installation verification received');
        break;

      case 'issue':
        await handleIssue(JSON.parse(body), GITHUB_TOKEN, GITHUB_REPO);
        break;

      case 'event_alert':
        await handleEventAlert(JSON.parse(body), GITHUB_TOKEN, GITHUB_REPO);
        break;

      default:
        logger.info('Sentry webhook: unhandled resource', { resource });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Sentry webhook handler error', { resource, error: message });
    // Return 200 to prevent Sentry retry storms (same as Stripe webhook pattern)
  }

  return NextResponse.json({ received: true });
}

// ── Signature Verification ──────────────────────────────────────────

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  try {
    // Sentry signatures are hex strings — convert to ArrayBuffer for crypto.subtle.verify
    const hexPairs = signature.match(/../g);
    if (!hexPairs) return false;
    const signatureBytes = new Uint8Array(hexPairs.map((h) => parseInt(h, 16)));
    return await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(body));
  } catch {
    return false;
  }
}

// ── Issue Handler ───────────────────────────────────────────────────

interface SentryIssuePayload {
  action: string;
  data: {
    issue: {
      id: string;
      title: string;
      culprit: string;
      level: string;
      count: number;
      permalink: string;
      metadata?: {
        type?: string;
        value?: string;
        filename?: string;
      };
    };
  };
}

async function handleIssue(
  payload: SentryIssuePayload,
  githubToken: string | undefined,
  githubRepo: string | undefined,
) {
  if (payload.action !== 'created') return;

  const { issue } = payload.data;
  const level = issue.level;

  // Only create GitHub issues for error/fatal severity
  if (level !== 'error' && level !== 'fatal') {
    logger.info('Sentry issue skipped (non-critical)', { level, issueId: issue.id });
    return;
  }

  const title = `[sentry] ${issue.title}`;
  const labels = ['bug', 'sentry', `severity:${level}`];
  const body = formatIssueBody(issue);

  await createGitHubIssue(title, body, labels, githubToken, githubRepo);
}

function formatIssueBody(issue: SentryIssuePayload['data']['issue']): string {
  const lines = [
    '## Sentry Error',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Error** | ${issue.metadata?.type ?? 'Unknown'}: ${issue.metadata?.value ?? issue.title} |`,
    `| **Culprit** | \`${issue.culprit}\` |`,
    ...(issue.metadata?.filename ? [`| **File** | \`${issue.metadata.filename}\` |`] : []),
    `| **Level** | ${issue.level} |`,
    `| **Events** | ${issue.count} |`,
    `| **Sentry** | [View full details](${issue.permalink}) |`,
    '',
    '> Full stack trace, breadcrumbs, and replay available at the Sentry link above.',
  ];
  return lines.join('\n');
}

// ── Event Alert Handler (User Feedback) ─────────────────────────────

interface SentryEventAlertPayload {
  action: string;
  data: {
    event: {
      title: string;
      event_id: string;
      web_url: string;
      user?: {
        email?: string;
        username?: string;
      };
      contexts?: {
        feedback?: {
          message?: string;
          contact_email?: string;
          name?: string;
        };
      };
    };
  };
}

async function handleEventAlert(
  payload: SentryEventAlertPayload,
  githubToken: string | undefined,
  githubRepo: string | undefined,
) {
  if (payload.action !== 'triggered') return;

  const { event } = payload.data;
  const feedback = event.contexts?.feedback;

  // Only create GitHub issues if there's actual feedback content
  if (!feedback?.message) {
    logger.info('Sentry event_alert skipped (no feedback message)', {
      eventId: event.event_id,
    });
    return;
  }

  const title = `[feedback] ${feedback.message.slice(0, 80)}`;
  const labels = ['feedback', 'user-reported'];
  const body = formatFeedbackBody(event, feedback);

  await createGitHubIssue(title, body, labels, githubToken, githubRepo);
}

function formatFeedbackBody(
  event: SentryEventAlertPayload['data']['event'],
  feedback: NonNullable<SentryEventAlertPayload['data']['event']['contexts']>['feedback'],
): string {
  const lines = [
    '## User Feedback',
    '',
    `> ${feedback?.message}`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    ...(feedback?.name ? [`| **Name** | ${feedback.name} |`] : []),
    ...(feedback?.contact_email ? [`| **Email** | ${feedback.contact_email} |`] : []),
    `| **Event** | ${event.title} |`,
    `| **Sentry** | [View event](${event.web_url}) |`,
  ];
  return lines.join('\n');
}

// ── GitHub Issue Creation ───────────────────────────────────────────

async function createGitHubIssue(
  title: string,
  body: string,
  labels: string[],
  token: string | undefined,
  repo: string | undefined,
) {
  if (!token || !repo) {
    logger.warn(
      'Sentry→GitHub: GITHUB_TOKEN or GITHUB_REPO not configured, skipping issue creation',
    );
    return;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  const issue = (await response.json()) as { number: number; html_url: string };
  logger.info('Sentry→GitHub: issue created', {
    issueNumber: issue.number,
    url: issue.html_url,
  });
}
