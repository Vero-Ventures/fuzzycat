import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/lib/env';

/**
 * Returns true if MFA enforcement is enabled via the ENABLE_MFA env var.
 */
export function isMfaEnabled(): boolean {
  return serverEnv().ENABLE_MFA === 'true';
}

/**
 * Enforces MFA for the current session.
 * - If MFA is disabled via feature flag, returns immediately.
 * - If no TOTP factor is enrolled, redirects to /mfa/setup.
 * - If a TOTP factor exists but the session is not AAL2, redirects to /mfa/verify.
 */
export async function enforceMfa(supabase: SupabaseClient) {
  if (!isMfaEnabled()) return;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === 'aal2') return;

  const { data: mfaFactors } = await supabase.auth.mfa.listFactors();
  const hasTotp = mfaFactors?.totp?.some((f) => f.status === 'verified');
  if (!hasTotp) {
    redirect('/mfa/setup');
  }
  redirect('/mfa/verify');
}
