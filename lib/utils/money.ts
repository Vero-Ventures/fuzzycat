// ── Integer cents helpers ────────────────────────────────────────────
// All monetary values must use integer cents — no floating point.

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Convert a dollar amount to integer cents. */
export function toCents(dollars: number): number {
  if (!Number.isFinite(dollars) || dollars < 0) {
    throw new RangeError(`toCents: invalid dollar amount ${dollars}`);
  }
  return Math.round(dollars * 100);
}

/** Format integer cents as a USD currency string (e.g. "$12.50"). */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents) || !Number.isInteger(cents)) {
    throw new RangeError(`formatCents: invalid cents value ${cents}`);
  }
  return currencyFormatter.format(cents / 100);
}

/** Sum any number of cent amounts. Returns 0 for no args. */
export function addCents(...amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) {
    total += amount;
  }
  return total;
}

/** Calculate a percentage of a cent amount, rounded to the nearest cent. */
export function percentOfCents(cents: number, rate: number): number {
  if (cents < 0 || !Number.isFinite(cents)) {
    throw new RangeError(`percentOfCents: invalid cents value ${cents}`);
  }
  if (rate < 0 || !Number.isFinite(rate)) {
    throw new RangeError(`percentOfCents: invalid rate ${rate}`);
  }
  return Math.round(cents * rate);
}
