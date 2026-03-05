// ── FuzzyCat business constants ──────────────────────────────────────
// All rates are decimals (e.g., 0.09 = 9%). Monetary values in cents.

/** Platform fee charged to pet owners (currently 9% of bill). */
export const PLATFORM_FEE_RATE = 0.09;

/** Platform fee as a whole-number percentage (e.g. 9). Derived from PLATFORM_FEE_RATE. */
export const FEE_PERCENT = Math.round(PLATFORM_FEE_RATE * 100);

/** Upfront deposit as a fraction of total (bill + fee). */
export const DEPOSIT_RATE = 0.25;

/** Revenue share paid to clinics per enrollment. */
export const CLINIC_SHARE_RATE = 0.03;

/** Clinic share as a whole-number percentage (e.g. 3). Derived from CLINIC_SHARE_RATE. */
export const CLINIC_SHARE_PERCENT = Math.round(CLINIC_SHARE_RATE * 100);

/** Fraction of each transaction allocated to the platform reserve. */
export const PLATFORM_RESERVE_RATE = 0.01;

/** Number of biweekly installments after the deposit. */
export const NUM_INSTALLMENTS = 6;

/** Minimum bill amount in cents ($500). Below this, FuzzyCat loses money. */
export const MIN_BILL_CENTS = 50_000;

/** Maximum bill amount in cents ($25,000). Above this, risk exposure is too high. */
export const MAX_BILL_CENTS = 2_500_000;

// ── Growth / Referral constants ──────────────────────────────────────

/** Maximum number of clinics that can join the Founding Clinic program. */
export const FOUNDING_CLINIC_LIMIT = 50;

/** Enhanced revenue share for founding clinics in basis points (5%). */
export const FOUNDING_CLINIC_SHARE_BPS = 500;

/** Duration of enhanced revenue share for founding clinics (months). */
export const FOUNDING_CLINIC_DURATION_MONTHS = 3;

/** Default clinic revenue share in basis points (3%). */
export const DEFAULT_CLINIC_SHARE_BPS = 300;

/** Temporary bonus BPS added to referrer clinic's share per converted referral. */
export const CLINIC_REFERRAL_BONUS_BPS = 200;

/** Duration of referral bonus for referring clinic (months). */
export const CLINIC_REFERRAL_BONUS_MONTHS = 6;

/** Fee discount for a referred client in cents ($20). */
export const CLIENT_REFERRAL_DISCOUNT_CENTS = 2_000;

/** Credit for referrer client when referral converts in cents ($20). */
export const CLIENT_REFERRAL_CREDIT_CENTS = 2_000;
