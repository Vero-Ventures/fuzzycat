// ── Phone number validation (US, E.164 format) ─────────────────────

/**
 * E.164 pattern for US phone numbers: +1 followed by 10 digits.
 * The first digit after +1 must be 2-9 (area code cannot start with 0 or 1).
 */
const US_E164_REGEX = /^\+1[2-9]\d{9}$/;

/**
 * Validate that a phone number is a valid US phone number in E.164 format.
 *
 * @param phone - The phone number string to validate
 * @returns `true` if the number matches the US E.164 pattern (+1XXXXXXXXXX)
 *
 * @example
 * isValidUSPhone('+12125551234') // true
 * isValidUSPhone('+11125551234') // false (area code starts with 1)
 * isValidUSPhone('2125551234')   // false (missing +1 prefix)
 * isValidUSPhone('+442071234567') // false (not US)
 */
export function isValidUSPhone(phone: string): boolean {
  return US_E164_REGEX.test(phone);
}

/**
 * Attempt to normalize a US phone number to E.164 format.
 *
 * Handles common input formats:
 * - `(212) 555-1234` -> `+12125551234`
 * - `212-555-1234`   -> `+12125551234`
 * - `212.555.1234`   -> `+12125551234`
 * - `2125551234`     -> `+12125551234`
 * - `12125551234`    -> `+12125551234`
 * - `+12125551234`   -> `+12125551234` (already E.164)
 *
 * @param phone - The phone number string to normalize
 * @returns The E.164 formatted number, or `null` if it cannot be normalized
 */
export function normalizeUSPhone(phone: string): string | null {
  // Strip all non-digit characters except leading +
  const digits = phone.replace(/[^\d]/g, '');

  let normalized: string;

  if (digits.length === 10) {
    // 10 digits: prepend +1
    normalized = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // 11 digits starting with 1: prepend +
    normalized = `+${digits}`;
  } else {
    return null;
  }

  return isValidUSPhone(normalized) ? normalized : null;
}
