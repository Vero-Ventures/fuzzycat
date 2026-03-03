'use server';

import { z } from 'zod';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/server/db';
import { clinicRequests } from '@/server/db/schema';

const requestSchema = z.object({
  ownerEmail: z.string().email('Please enter a valid email address.'),
  ownerName: z.string().optional(),
  clinicName: z.string().min(1, 'Clinic name is required.'),
  clinicCity: z.string().optional(),
  clinicState: z.string().optional(),
  clinicZip: z.string().optional(),
});

export async function submitClinicRequest(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const { success: allowed } = await checkRateLimit();
  if (!allowed) {
    return { error: 'Too many requests. Please try again later.', success: false };
  }

  const parsed = requestSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join(' '),
      success: false,
    };
  }

  try {
    await db.insert(clinicRequests).values({
      ownerEmail: parsed.data.ownerEmail,
      ownerName: parsed.data.ownerName || null,
      clinicName: parsed.data.clinicName,
      clinicCity: parsed.data.clinicCity || null,
      clinicState: parsed.data.clinicState || null,
      clinicZip: parsed.data.clinicZip || null,
    });

    logger.info('Clinic request submitted', {
      ownerEmail: parsed.data.ownerEmail,
      clinicName: parsed.data.clinicName,
    });

    return { error: null, success: true };
  } catch (err) {
    logger.error('Failed to submit clinic request', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: 'Something went wrong. Please try again.', success: false };
  }
}
