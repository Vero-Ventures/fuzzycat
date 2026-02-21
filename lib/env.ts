import { z } from 'zod';

/**
 * Server-side environment variables.
 * Validated lazily on first access to avoid build-time errors (Next.js build
 * does not have runtime env vars available during static analysis).
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),
  RESEND_API_KEY: z.string().startsWith('re_', 'RESEND_API_KEY must start with re_'),
  PLAID_CLIENT_ID: z.string().min(1, 'PLAID_CLIENT_ID is required'),
  PLAID_SECRET: z.string().min(1, 'PLAID_SECRET is required'),
  PLAID_ENV: z.enum(['sandbox', 'production'], {
    error: 'PLAID_ENV must be "sandbox" or "production"',
  }),
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC', 'TWILIO_ACCOUNT_SID must start with AC'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_PHONE_NUMBER: z
    .string()
    .startsWith('+', 'TWILIO_PHONE_NUMBER must be in E.164 format (start with +)'),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
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
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .startsWith('pk_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_'),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
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

/** @internal Reset cached env for testing. */
export function _resetEnvCache() {
  _serverEnv = undefined;
  _publicEnv = undefined;
}

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
