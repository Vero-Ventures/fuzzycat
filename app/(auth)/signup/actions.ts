'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/server/db';
import { clinics, owners } from '@/server/db/schema';

type ActionResult = { error: string | null };

export async function signUpOwner(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const phone = formData.get('phone') as string;
  const petName = formData.get('petName') as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: 'Failed to create user' };
  }

  // Set role in app_metadata via admin client (users can't modify app_metadata)
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: 'owner' },
  });

  // Insert owner record linked to auth user
  await db.insert(owners).values({
    authId: data.user.id,
    name,
    email,
    phone,
    petName,
    paymentMethod: 'debit_card',
  });

  return { error: null };
}

export async function signUpClinic(formData: FormData): Promise<ActionResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const clinicName = formData.get('clinicName') as string;
  const phone = formData.get('phone') as string;
  const addressState = formData.get('addressState') as string;
  const addressZip = formData.get('addressZip') as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: 'Failed to create user' };
  }

  // Set role in app_metadata via admin client
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: 'clinic' },
  });

  // Insert clinic record linked to auth user
  await db.insert(clinics).values({
    authId: data.user.id,
    name: clinicName,
    email,
    phone,
    addressState: addressState.toUpperCase(),
    addressZip,
  });

  return { error: null };
}
