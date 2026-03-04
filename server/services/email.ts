import type { ReactNode } from 'react';
import { resend } from '@/lib/resend';
import type { ClinicWelcomeProps } from '@/server/emails/clinic-welcome';
import { ClinicWelcome } from '@/server/emails/clinic-welcome';
import type { EnrollmentInviteProps } from '@/server/emails/enrollment-invite';
import { EnrollmentInvite } from '@/server/emails/enrollment-invite';
import type { SoftCollectionDay1Props } from '@/server/emails/soft-collection-day1';
import { SoftCollectionDay1 } from '@/server/emails/soft-collection-day1';
import type { SoftCollectionDay7Props } from '@/server/emails/soft-collection-day7';
import { SoftCollectionDay7 } from '@/server/emails/soft-collection-day7';
import type { SoftCollectionDay14Props } from '@/server/emails/soft-collection-day14';
import { SoftCollectionDay14 } from '@/server/emails/soft-collection-day14';

// ── Constants ────────────────────────────────────────────────────────

const FROM_ADDRESS = 'FuzzyCat <noreply@fuzzycatapp.com>';

// ── Types ────────────────────────────────────────────────────────────

export interface SendEmailResult {
  id: string;
}

// ── Internal helper ──────────────────────────────────────────────────

/**
 * Send an email via Resend and return the email ID.
 * Throws a descriptive error if the Resend API returns an error.
 */
async function sendEmail(options: {
  to: string;
  subject: string;
  react: ReactNode;
  errorContext: string;
}): Promise<SendEmailResult> {
  const { data, error } = await resend().emails.send({
    from: FROM_ADDRESS,
    to: options.to,
    subject: options.subject,
    react: options.react,
  });

  if (error) {
    throw new Error(`Failed to send ${options.errorContext} email: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Failed to send ${options.errorContext} email: no data returned`);
  }

  return { id: data.id };
}

// ── Email send functions ─────────────────────────────────────────────

/**
 * Send welcome email to a newly registered clinic.
 * Includes onboarding steps and Stripe Connect setup link.
 */
export async function sendClinicWelcome(
  to: string,
  props: ClinicWelcomeProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Welcome to FuzzyCat, ${props.clinicName}!`,
    react: ClinicWelcome(props),
    errorContext: 'clinic welcome',
  });
}

/**
 * Send enrollment invite email to a pet owner.
 * Includes payment plan summary and link to set up account + pay deposit.
 */
export async function sendEnrollmentInvite(
  to: string,
  props: EnrollmentInviteProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Your payment plan for ${props.petName} is ready`,
    react: EnrollmentInvite(props),
    errorContext: 'enrollment invite',
  });
}

// ── Soft collection email functions ──────────────────────────────────

/**
 * Send Day 1 soft collection email — friendly reminder that plan is paused.
 * Sent on the day a plan defaults.
 */
export async function sendSoftCollectionDay1(
  to: string,
  props: SoftCollectionDay1Props,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Your payment plan for ${props.petName} needs attention`,
    react: SoftCollectionDay1(props),
    errorContext: 'soft collection day 1',
  });
}

/**
 * Send Day 7 soft collection email — moderate urgency follow-up.
 * Sent 7 days after a plan defaults.
 */
export async function sendSoftCollectionDay7(
  to: string,
  props: SoftCollectionDay7Props,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Action required: Update your payment method for ${props.petName}'s plan`,
    react: SoftCollectionDay7(props),
    errorContext: 'soft collection day 7',
  });
}

/**
 * Send Day 14 soft collection email — final notice.
 * Sent 14 days after a plan defaults.
 */
export async function sendSoftCollectionDay14(
  to: string,
  props: SoftCollectionDay14Props,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Final notice: Your payment plan for ${props.petName}`,
    react: SoftCollectionDay14(props),
    errorContext: 'soft collection day 14',
  });
}
