/** Escape ILIKE special characters (% and _) in user input */
export function escapeIlike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}
