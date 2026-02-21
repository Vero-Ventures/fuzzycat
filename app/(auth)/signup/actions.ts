'use server';

import { z } from 'zod';
import { verifyCaptcha } from '@/lib/captcha';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { clinics, owners } from '@/server/db/schema';

type ActionResult = { error: string | null };

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
  if (serverEnv().TURNSTILE_SECRET_KEY) {
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
    return { userId: null, error: error.message };
  }

  if (!data.user) {
    return { userId: null, error: 'Failed to create user' };
  }

  const admin = createAdminClient();
  const { error: roleError } = await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });

  if (roleError) {
    logger.error('Failed to set user role', {
      userId: data.user.id,
      role,
      error: roleError.message,
    });
    await admin.auth.admin.deleteUser(data.user.id);
    return { userId: null, error: 'Failed to configure account. Please try again.' };
  }

  return { userId: data.user.id, error: null };
}

/** Delete the Supabase auth user when the DB insert fails to prevent orphaned accounts. */
async function deleteAuthUser(userId: string | null) {
  if (!userId) return;
  try {
    const admin = createAdminClient();
    await admin.auth.admin.deleteUser(userId);
  } catch (_error) {
    logger.error('Failed to delete orphaned auth user', { userId });
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
  const { userId, error } = await signUpWithRole(email, password, 'owner');

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
    logger.error('Failed to insert owner into DB', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    await deleteAuthUser(userId);
    return { error: 'Failed to create account. Please try again.' };
  }

  return { error: null };
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
  const { userId, error } = await signUpWithRole(email, password, 'clinic');

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
    logger.error('Failed to insert clinic into DB', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    await deleteAuthUser(userId);
    return { error: 'Failed to create account. Please try again.' };
  }

  return { error: null };
}
