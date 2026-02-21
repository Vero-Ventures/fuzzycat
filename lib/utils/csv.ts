// ── CSV generation utility ──────────────────────────────────────────
// Generates RFC 4180-compliant CSV strings with proper escaping for
// commas, double quotes, and newlines within values.

/**
 * Escape a single CSV field value according to RFC 4180.
 *
 * A field is wrapped in double quotes when it contains:
 * - Commas (,)
 * - Double quotes (")
 * - Newlines (\n or \r)
 *
 * Double quotes within a value are escaped by doubling them ("").
 */
function escapeField(value: string | number): string {
  const str = String(value);

  // Check if the field needs quoting
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape double quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Generate a CSV string from headers and rows.
 *
 * @param headers - Column header names
 * @param rows - Array of row data (each row is an array of string or number values)
 * @returns RFC 4180-compliant CSV string with CRLF line endings
 *
 * @example
 * ```ts
 * const csv = generateCsv(
 *   ['Name', 'Email', 'Amount'],
 *   [
 *     ['John Doe', 'john@example.com', 5000],
 *     ['Jane "JJ" Smith', 'jane@example.com', 7500],
 *   ],
 * );
 * ```
 */
export function generateCsv(headers: string[], rows: (string | number)[][]): string {
  const headerLine = headers.map(escapeField).join(',');
  const dataLines = rows.map((row) => row.map(escapeField).join(','));

  return [headerLine, ...dataLines].join('\r\n');
}
