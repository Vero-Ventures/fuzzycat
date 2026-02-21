import type { ReactNode } from 'react';
import { resend } from '@/lib/resend';
import type { ClinicPayoutProps } from '@/server/emails/clinic-payout';
import { ClinicPayout } from '@/server/emails/clinic-payout';
import type { ClinicWelcomeProps } from '@/server/emails/clinic-welcome';
import { ClinicWelcome } from '@/server/emails/clinic-welcome';
import type { EnrollmentConfirmationProps } from '@/server/emails/enrollment-confirmation';
import { EnrollmentConfirmation } from '@/server/emails/enrollment-confirmation';
import type { PaymentFailedProps } from '@/server/emails/payment-failed';
import { PaymentFailed } from '@/server/emails/payment-failed';
import type { PaymentReminderProps } from '@/server/emails/payment-reminder';
import { PaymentReminder } from '@/server/emails/payment-reminder';
import type { PaymentSuccessProps } from '@/server/emails/payment-success';
import { PaymentSuccess } from '@/server/emails/payment-success';
import type { PlanCompletedProps } from '@/server/emails/plan-completed';
import { PlanCompleted } from '@/server/emails/plan-completed';
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
 * Send enrollment confirmation email to a pet owner.
 * Includes plan summary, payment schedule, and disclosures.
 */
export async function sendEnrollmentConfirmation(
  to: string,
  props: EnrollmentConfirmationProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Purrfect -- Your Payment Plan for ${props.petName} Is Confirmed`,
    react: EnrollmentConfirmation(props),
    errorContext: 'enrollment confirmation',
  });
}

/**
 * Send payment reminder email to a pet owner.
 * Sent 3 days before each installment.
 */
export async function sendPaymentReminder(
  to: string,
  props: PaymentReminderProps,
): Promise<SendEmailResult> {
  const dateStr = props.scheduledDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return sendEmail({
    to,
    subject: `Reminder: ${props.petName}'s Payment Due on ${dateStr}`,
    react: PaymentReminder(props),
    errorContext: 'payment reminder',
  });
}

/**
 * Send payment success email to a pet owner.
 * Confirms each successful payment with remaining balance info.
 */
export async function sendPaymentSuccess(
  to: string,
  props: PaymentSuccessProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Payment Received for ${props.petName}'s Care`,
    react: PaymentSuccess(props),
    errorContext: 'payment success',
  });
}

/**
 * Send payment failed email to a pet owner.
 * Includes failure reason, retry info, and next steps.
 */
export async function sendPaymentFailed(
  to: string,
  props: PaymentFailedProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Action Needed: Payment for ${props.petName}'s Plan Was Not Successful`,
    react: PaymentFailed(props),
    errorContext: 'payment failed',
  });
}

/**
 * Send plan completed email to a pet owner.
 * Congratulations message when all payments are done.
 */
export async function sendPlanCompleted(
  to: string,
  props: PlanCompletedProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `All Paid Up -- ${props.petName}'s Payment Plan Is Complete!`,
    react: PlanCompleted(props),
    errorContext: 'plan completed',
  });
}

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
 * Send payout notification email to a clinic.
 * Confirms funds transferred with amount and plan reference.
 */
export async function sendClinicPayoutNotification(
  to: string,
  props: ClinicPayoutProps,
): Promise<SendEmailResult> {
  return sendEmail({
    to,
    subject: `Payout Sent: ${props.ownerName}'s Payment for ${props.petName}`,
    react: ClinicPayout(props),
    errorContext: 'clinic payout notification',
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
