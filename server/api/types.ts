// ── Hono context types for external REST API ─────────────────────────

export interface ApiVariables {
  /** The authenticated clinic's database ID. */
  clinicId: string;
  /** Permission scopes granted to the API key. */
  permissions: string[];
  /** Unique request ID for log correlation. */
  requestId: string;
}

/** All valid permission scopes for external API keys. */
export const API_PERMISSIONS = [
  'enrollments:read',
  'enrollments:write',
  'clinic:read',
  'clinic:write',
  'clients:read',
  'export:read',
  'payouts:read',
] as const;

export type ApiPermission = (typeof API_PERMISSIONS)[number];
