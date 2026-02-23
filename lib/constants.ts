// ── FuzzyCat business constants ──────────────────────────────────────
// All rates are decimals (e.g., 0.06 = 6%). Monetary values in cents.

/** Platform fee charged to pet owners (6% of bill). */
export const PLATFORM_FEE_RATE = 0.06;

/** Upfront deposit as a fraction of total (bill + fee). */
export const DEPOSIT_RATE = 0.25;

/** Revenue share paid to clinics per enrollment. */
export const CLINIC_SHARE_RATE = 0.03;

/** Fraction of each transaction allocated to the platform reserve. */
export const PLATFORM_RESERVE_RATE = 0.01;

/** @deprecated Use PLATFORM_RESERVE_RATE instead. */
export const RISK_POOL_RATE = PLATFORM_RESERVE_RATE;

/** Number of biweekly installments after the deposit. */
export const NUM_INSTALLMENTS = 6;

/** Minimum bill amount in cents ($500). Below this, FuzzyCat loses money. */
export const MIN_BILL_CENTS = 50_000;

/** Maximum bill amount in cents ($25,000). Above this, risk exposure is too high. */
export const MAX_BILL_CENTS = 2_500_000;
