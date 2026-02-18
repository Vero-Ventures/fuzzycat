import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

/**
 * Enforces MFA for the current session. If the user has enrolled a TOTP factor
 * but hasn't verified it this session (AAL1 instead of AAL2), redirects to /mfa/verify.
 */
export async function enforceMfa(supabase: SupabaseClient) {
  const { data: mfaFactors } = await supabase.auth.mfa.listFactors();
  const hasTotp = mfaFactors?.totp?.some((f) => f.status === 'verified');
  if (hasTotp) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      redirect('/mfa/verify');
    }
  }
}
