import { z } from 'zod';

/**
 * Server-side environment variables.
 * Validated lazily on first access to avoid build-time errors (Next.js build
 * does not have runtime env vars available during static analysis).
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

/**
 * Public environment variables (available on both client and server).
 * These use the NEXT_PUBLIC_ prefix and are inlined at build time.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
});

/** @internal Exported for testing. */
export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const messages = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Missing or invalid environment variables:\n${messages.join('\n')}`);
  }
  return result.data;
}

let _serverEnv: z.infer<typeof serverSchema> | undefined;
let _publicEnv: z.infer<typeof publicSchema> | undefined;

/** Validated server environment variables. Throws on first access if invalid. */
export function serverEnv() {
  if (!_serverEnv) {
    _serverEnv = validateEnv(serverSchema, process.env);
  }
  return _serverEnv;
}

/** Validated public environment variables. Throws on first access if invalid. */
export function publicEnv() {
  if (!_publicEnv) {
    _publicEnv = validateEnv(publicSchema, process.env);
  }
  return _publicEnv;
}
