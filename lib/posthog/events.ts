/**
 * Typed PostHog event names for consistent tracking across client and server.
 * Use these constants instead of raw strings to prevent typos and enable refactoring.
 */
export const POSTHOG_EVENTS = {
  // Enrollment
  ENROLLMENT_STARTED: 'enrollment_started',
  ENROLLMENT_COMPLETED: 'enrollment_completed',
  ENROLLMENT_ABANDONED: 'enrollment_abandoned',

  // Payment
  PAYMENT_SUCCEEDED: 'payment_succeeded',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_RETRIED: 'payment_retried',

  // Clinic
  CLINIC_REGISTERED: 'clinic_registered',
  CLINIC_ACTIVATED: 'clinic_activated',
  CLINIC_PAYOUT_SENT: 'clinic_payout_sent',

  // Performance
  WEB_VITAL_CAPTURED: 'web_vital_captured',

  // Auth
  AUTH_SIGNED_UP: 'auth_signed_up',
  AUTH_SIGNED_IN: 'auth_signed_in',
  AUTH_SIGNED_OUT: 'auth_signed_out',
  AUTH_MFA_ENROLLED: 'auth_mfa_enrolled',
} as const;

export type PostHogEvent = (typeof POSTHOG_EVENTS)[keyof typeof POSTHOG_EVENTS];
