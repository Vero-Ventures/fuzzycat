// ── SMS service ─────────────────────────────────────────────────────
// Twilio-backed SMS for payment reminders, failure notifications, and
// default warnings. Includes TCPA-compliant opt-out handling and
// in-memory rate limiting.
//
// LIMITATIONS (documented for production hardening):
// - Opt-out set is in-memory. It resets on server restart. Production
//   should persist opt-outs to the database (e.g., an `sms_opt_outs`
//   table or a boolean on the `owners` table).
// - Rate limiting is in-memory (Map of phone -> timestamps). Production
//   should use Redis (Upstash) for persistence across instances.
// - First-message tracking is in-memory. Production should persist to DB.

import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { twilio } from '@/lib/twilio';
import { formatCents } from '@/lib/utils/money';
import { isValidUSPhone } from '@/lib/utils/phone';
import type { UrgencyLevel } from '@/server/services/collection';

// ── Types ─────────────────────────────────────────────────────────────

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PaymentReminderParams {
  amountCents: number;
  date: Date;
  planId: string;
}

export interface PaymentFailedParams {
  amountCents: number;
  retryDate: Date;
  planId: string;
}

export interface PaymentFailedWithUrgencyParams {
  amountCents: number;
  retryDate: Date;
  planId: string;
  urgencyLevel: UrgencyLevel;
}

export interface DefaultWarningParams {
  planId: string;
}

export interface PaymentSuccessParams {
  amountCents: number;
  remainingCents: number;
  planId: string;
}

// ── Configuration ─────────────────────────────────────────────────────

/** Maximum SMS messages per phone number per day. */
const MAX_SMS_PER_DAY = 10;

/** Time window for rate limiting (24 hours in ms). */
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** TCPA-required opt-out notice appended to first message per phone number. */
const TCPA_OPT_OUT_NOTICE = '\n\nReply STOP to opt out of FuzzyCat SMS notifications.';

// ── Opt-out tracking (in-memory) ──────────────────────────────────────
// LIMITATION: Resets on server restart. Production should use a database.

const optedOutPhones = new Set<string>();

/**
 * Record a phone number as opted out of SMS (STOP keyword).
 * TCPA requires honoring opt-outs immediately.
 */
export function recordOptOut(phone: string): void {
  optedOutPhones.add(phone);
  logger.info('SMS opt-out recorded', { phone: maskPhone(phone) });
}

/**
 * Record a phone number as opted back in (START keyword).
 */
export function recordOptIn(phone: string): void {
  optedOutPhones.delete(phone);
  logger.info('SMS opt-in recorded', { phone: maskPhone(phone) });
}

/** Check whether a phone number has opted out. */
export function isOptedOut(phone: string): boolean {
  return optedOutPhones.has(phone);
}

// ── First-message tracking (in-memory) ────────────────────────────────
// TCPA requires opt-out instructions on first contact.
// LIMITATION: Resets on server restart. Production should use a database.

const contactedPhones = new Set<string>();

/** Check if we have previously sent an SMS to this phone number. */
function isFirstMessage(phone: string): boolean {
  return !contactedPhones.has(phone);
}

/** Mark a phone as having received at least one message. */
function markContacted(phone: string): void {
  contactedPhones.add(phone);
}

// ── Rate limiting (in-memory) ─────────────────────────────────────────
// LIMITATION: Resets on server restart and is per-instance.
// Production should use Redis (Upstash) for distributed rate limiting.

const sendTimestamps = new Map<string, number[]>();

/**
 * Check if sending another SMS to this phone would exceed the daily limit.
 * Returns `true` if the send is allowed.
 */
function checkRateLimit(phone: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;

  const timestamps = sendTimestamps.get(phone) ?? [];
  // Remove timestamps outside the window
  const recent = timestamps.filter((ts) => ts > cutoff);
  sendTimestamps.set(phone, recent);

  return recent.length < MAX_SMS_PER_DAY;
}

/** Record a successful send timestamp for rate limiting. */
function recordSend(phone: string): void {
  const timestamps = sendTimestamps.get(phone) ?? [];
  timestamps.push(Date.now());
  sendTimestamps.set(phone, timestamps);
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Mask a phone number for logging (show last 4 digits only). */
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return `****${phone.slice(-4)}`;
}

/** Format a Date as a short human-readable string (e.g., "Feb 20, 2026"). */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Append TCPA opt-out instructions to the first message sent to a number. */
function appendOptOutNotice(body: string, phone: string): string {
  if (isFirstMessage(phone)) {
    return `${body}${TCPA_OPT_OUT_NOTICE}`;
  }
  return body;
}

// ── Core send function ────────────────────────────────────────────────

/**
 * Send an SMS via Twilio with validation, opt-out checking, and rate limiting.
 *
 * @internal Exported for testing. Prefer the specific send* functions below.
 */
export async function sendSms(phone: string, body: string): Promise<SmsResult> {
  // 1. Validate phone number
  if (!isValidUSPhone(phone)) {
    logger.warn('SMS send rejected: invalid phone number', { phone: maskPhone(phone) });
    return { success: false, error: 'Invalid US phone number' };
  }

  // 2. Check opt-out status (TCPA compliance)
  if (isOptedOut(phone)) {
    logger.info('SMS send skipped: phone has opted out', { phone: maskPhone(phone) });
    return { success: false, error: 'Phone number has opted out of SMS' };
  }

  // 3. Check rate limit
  if (!checkRateLimit(phone)) {
    logger.warn('SMS send rejected: rate limit exceeded', { phone: maskPhone(phone) });
    return { success: false, error: 'Daily SMS rate limit exceeded' };
  }

  // 4. Append opt-out notice if first message
  const finalBody = appendOptOutNotice(body, phone);

  // 5. Send via Twilio
  try {
    const env = serverEnv();
    const message = await twilio().messages.create({
      to: phone,
      from: env.TWILIO_PHONE_NUMBER,
      body: finalBody,
    });

    // Record successful send
    recordSend(phone);
    markContacted(phone);

    logger.info('SMS sent successfully', {
      phone: maskPhone(phone),
      messageId: message.sid,
    });

    return { success: true, messageId: message.sid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('SMS send failed', {
      phone: maskPhone(phone),
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

// ── Public send functions ─────────────────────────────────────────────

/**
 * Send a payment reminder SMS.
 * Sent 3 days before each scheduled installment.
 */
export async function sendPaymentReminder(
  phone: string,
  params: PaymentReminderParams,
): Promise<SmsResult> {
  const body = `FuzzyCat: Your payment of ${formatCents(params.amountCents)} is scheduled for ${formatDate(params.date)}. Ensure your account has sufficient funds.`;

  logger.info('Sending payment reminder SMS', {
    phone: maskPhone(phone),
    planId: params.planId,
    amountCents: params.amountCents,
  });

  return sendSms(phone, body);
}

/**
 * Send a payment failure notification SMS.
 * Sent immediately after a payment attempt fails.
 */
export async function sendPaymentFailed(
  phone: string,
  params: PaymentFailedParams,
): Promise<SmsResult> {
  const body = `FuzzyCat: Your payment of ${formatCents(params.amountCents)} could not be processed. We'll retry on ${formatDate(params.retryDate)}. Please ensure your account has sufficient funds.`;

  logger.info('Sending payment failed SMS', {
    phone: maskPhone(phone),
    planId: params.planId,
    amountCents: params.amountCents,
  });

  return sendSms(phone, body);
}

/**
 * Send an urgency-aware payment failure notification SMS.
 * The message tone escalates with each retry attempt:
 * - Level 1: Friendly reminder
 * - Level 2: Urgent notice mentioning consequences
 * - Level 3: Final notice before plan defaults
 */
export async function sendPaymentFailedWithUrgency(
  phone: string,
  params: PaymentFailedWithUrgencyParams,
): Promise<SmsResult> {
  const amount = formatCents(params.amountCents);
  const retryDate = formatDate(params.retryDate);

  let body: string;

  switch (params.urgencyLevel) {
    case 1:
      body = `FuzzyCat: Your payment of ${amount} could not be processed. We'll try again on ${retryDate}. Please ensure your account has sufficient funds.`;
      break;
    case 2:
      body = `FuzzyCat: Important - your payment of ${amount} failed again. We'll retry on ${retryDate}. Please ensure funds are available to avoid disruption to your payment plan.`;
      break;
    case 3:
      body = `FuzzyCat: Final Notice - your payment of ${amount} has failed multiple times. Last retry on ${retryDate}. If this attempt fails, your plan will default. Please contact us if you need help.`;
      break;
  }

  logger.info('Sending urgency-aware payment failed SMS', {
    phone: maskPhone(phone),
    planId: params.planId,
    amountCents: params.amountCents,
    urgencyLevel: params.urgencyLevel,
  });

  return sendSms(phone, body);
}

/**
 * Send a default warning SMS.
 * Sent after all retry attempts have been exhausted.
 */
export async function sendDefaultWarning(
  phone: string,
  params: DefaultWarningParams,
): Promise<SmsResult> {
  const body =
    'FuzzyCat: Final notice — please update your payment method to avoid default on your payment plan. Contact us for assistance.';

  logger.info('Sending default warning SMS', {
    phone: maskPhone(phone),
    planId: params.planId,
  });

  return sendSms(phone, body);
}

/**
 * Send a payment success confirmation SMS.
 * Sent after each successful payment.
 */
export async function sendPaymentSuccess(
  phone: string,
  params: PaymentSuccessParams,
): Promise<SmsResult> {
  const remaining =
    params.remainingCents > 0
      ? `${formatCents(params.remainingCents)} remaining on your plan.`
      : 'Your plan is now complete. Thank you!';

  const body = `FuzzyCat: Payment of ${formatCents(params.amountCents)} received! ${remaining}`;

  logger.info('Sending payment success SMS', {
    phone: maskPhone(phone),
    planId: params.planId,
    amountCents: params.amountCents,
  });

  return sendSms(phone, body);
}

// ── Test helpers ──────────────────────────────────────────────────────
// Exported for use in tests only. These reset internal state.

/** @internal Reset all in-memory state (opt-outs, rate limits, contacts). For testing only. */
export function _resetSmsState(): void {
  optedOutPhones.clear();
  contactedPhones.clear();
  sendTimestamps.clear();
}
