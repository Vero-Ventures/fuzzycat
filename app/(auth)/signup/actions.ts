'use server';

import { z } from 'zod';
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
    // Clean up the orphaned auth user
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
  } catch {
    // Best-effort cleanup — log in production, but don't mask the original error
  }
}

export async function signUpOwner(formData: FormData): Promise<ActionResult> {
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
  } catch {
    await deleteAuthUser(userId);
    return { error: 'Failed to create account. Please try again.' };
  }

  return { error: null };
}

export async function signUpClinic(formData: FormData): Promise<ActionResult> {
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
  } catch {
    await deleteAuthUser(userId);
    return { error: 'Failed to create account. Please try again.' };
  }

  return { error: null };
}
