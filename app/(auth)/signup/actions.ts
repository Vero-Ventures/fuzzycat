'use server';

import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { verifyCaptcha } from '@/lib/captcha';
import { logger } from '@/lib/logger';
import { POSTHOG_EVENTS } from '@/lib/posthog/events';
import { getPostHogServer } from '@/lib/posthog/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { clinics, owners } from '@/server/db/schema';

type ActionResult = { error: string | null; needsEmailConfirmation?: boolean };

const DUPLICATE_EMAIL_ERROR = 'An account with this email already exists. Please log in instead.';

/** Detect PostgreSQL unique constraint violations (error code 23505) from Drizzle errors. */
function isUniqueConstraintViolation(error: unknown): boolean {
  const pgError = error as { code?: string };
  if (pgError.code === '23505') return true;
  if (error instanceof Error) {
    return (
      error.message.includes('unique') ||
      error.message.includes('23505') ||
      error.message.includes('duplicate key')
    );
  }
  return false;
}

const ownerSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  name: z.string().min(1, 'Name is required.'),
  phone: z.string().min(1, 'Phone is required.'),
  petName: z.string().min(1, 'Pet name is required.'),
});

const clinicSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  clinicName: z.string().min(1, 'Clinic name is required.'),
  phone: z.string().min(1, 'Phone is required.'),
  addressState: z.string().length(2, 'State must be a 2-letter code.'),
  addressZip: z.string().min(5, 'ZIP code is required.'),
});

async function validateCaptcha(formData: FormData): Promise<ActionResult | null> {
  const { serverEnv } = await import('@/lib/env');
  const env = serverEnv();
  if (env.DISABLE_CAPTCHA === 'true') return null;
  if (env.TURNSTILE_SECRET_KEY) {
    const captchaToken = formData.get('captchaToken') as string | null;
    const captchaValid = await verifyCaptcha(captchaToken ?? '');
    if (!captchaValid) {
      return { error: 'CAPTCHA verification failed. Please try again.' };
    }
  }
  return null;
}

async function signUpWithRole(email: string, password: string, role: 'owner' | 'clinic') {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { userId: null, hasSession: false, error: error.message };
  }

  if (!data.user) {
    return {
      userId: null,
      hasSession: false,
      error: 'Account creation failed — no user returned. (REF: AUTH-EMPTY)',
    };
  }

  // When Supabase has "Confirm email" enabled and user already exists,
  // it returns success with an empty identities array instead of an error.
  if (data.user.identities?.length === 0) {
    return { userId: null, hasSession: false, error: DUPLICATE_EMAIL_ERROR };
  }

  const admin = createAdminClient();
  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });

  if (roleError) {
    logger.error('Signup failed at role assignment', {
      step: 'role_assignment',
      userId: data.user.id,
      role,
      error: roleError.message,
    });
    Sentry.captureException(roleError, {
      tags: { component: 'signup', step: 'role_assignment' },
      extra: { userId: data.user.id, role },
    });
    await admin.auth.admin.deleteUser(data.user.id);
    return {
      userId: null,
      hasSession: false,
      error: 'Account created but role assignment failed. Please try again. (REF: ROLE-FAIL)',
    };
  }

  return { userId: data.user.id, hasSession: !!data.session, error: null };
}

/** Delete the Supabase auth user when the DB insert fails to prevent orphaned accounts. */
async function deleteAuthUser(userId: string | null) {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(userId);
  } catch (_error) {
    logger.error('Failed to delete orphaned auth user', { userId });
    Sentry.captureException(_error, {
      tags: { component: 'signup', step: 'orphan_cleanup' },
      extra: { userId },
    });
  }
}

export async function signUpOwner(formData: FormData): Promise<ActionResult> {
  const { success: allowed } = await checkRateLimit();
  if (!allowed) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const captchaError = await validateCaptcha(formData);
  if (captchaError) {
    return captchaError;
  }

  const parsed = ownerSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(' ') };
  }

  const { email, password, name, phone, petName } = parsed.data;
  const { userId, hasSession, error } = await signUpWithRole(email, password, 'owner');

  if (error) {
    return { error };
  }

  try {
    await db.insert(owners).values({
      authId: userId,
      name,
      email,
      phone,
      petName,
      paymentMethod: 'debit_card',
    });
  } catch (error) {
    const isDuplicate = isUniqueConstraintViolation(error);
    logger.error('Signup failed at DB insert', {
      step: 'db_insert',
      role: 'owner',
      userId,
      email,
      errorCode: (error as { code?: string }).code,
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, {
      tags: { component: 'signup', step: 'db_insert', role: 'owner' },
      extra: { userId, email },
    });
    await deleteAuthUser(userId);
    if (isDuplicate) {
      return { error: DUPLICATE_EMAIL_ERROR };
    }
    return {
      error:
        'Account setup failed due to a database error. Please try again or contact support. (REF: DB-OWNER)',
    };
  }

  if (userId) {
    getPostHogServer()?.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.AUTH_SIGNED_UP,
      properties: { role: 'owner' },
    });
  }

  return { error: null, needsEmailConfirmation: !hasSession };
}

export async function signUpClinic(formData: FormData): Promise<ActionResult> {
  const { success: allowed } = await checkRateLimit();
  if (!allowed) {
    return { error: 'Too many requests. Please try again later.' };
  }

  const captchaError = await validateCaptcha(formData);
  if (captchaError) {
    return captchaError;
  }

  const parsed = clinicSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(' ') };
  }

  const { email, password, clinicName, phone, addressState, addressZip } = parsed.data;
  const { userId, hasSession, error } = await signUpWithRole(email, password, 'clinic');

  if (error) {
    return { error };
  }

  try {
    await db.insert(clinics).values({
      authId: userId,
      name: clinicName,
      email,
      phone,
      addressState: addressState.toUpperCase(),
      addressZip,
    });
  } catch (error) {
    const isDuplicate = isUniqueConstraintViolation(error);
    logger.error('Signup failed at DB insert', {
      step: 'db_insert',
      role: 'clinic',
      userId,
      email,
      errorCode: (error as { code?: string }).code,
      error: error instanceof Error ? error.message : String(error),
    });
    Sentry.captureException(error, {
      tags: { component: 'signup', step: 'db_insert', role: 'clinic' },
      extra: { userId, email },
    });
    await deleteAuthUser(userId);
    if (isDuplicate) {
      return { error: DUPLICATE_EMAIL_ERROR };
    }
    return {
      error:
        'Account setup failed due to a database error. Please try again or contact support. (REF: DB-CLINIC)',
    };
  }

  if (userId) {
    getPostHogServer()?.capture({
      distinctId: userId,
      event: POSTHOG_EVENTS.CLINIC_REGISTERED,
      properties: { role: 'clinic' },
    });
  }

  return { error: null, needsEmailConfirmation: !hasSession };
}
