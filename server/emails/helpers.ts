// ── Email template helpers ───────────────────────────────────────────
// Formatting utilities for email content.

import { formatCents } from '@/lib/utils/money';

/**
 * Format integer cents as a USD currency string for display in emails.
 * Re-exports formatCents from the shared money utilities.
 */
export { formatCents };

/**
 * Format a Date as a human-readable string for emails.
 * Example: "February 20, 2026"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a Date as a shorter string for schedule tables.
 * Example: "Feb 20, 2026"
 */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
