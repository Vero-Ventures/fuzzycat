import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const role = (user.app_metadata?.role as string) ?? 'owner';
  if (role !== 'clinic' && role !== 'admin') {
    redirect('/login');
  }

  // MFA enforcement: if enrolled but not verified this session, redirect to verify
  const { data: mfaFactors } = await supabase.auth.mfa.listFactors();
  const hasTotp = mfaFactors?.totp?.some((f) => f.status === 'verified');
  if (hasTotp) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== 'aal2') {
      redirect('/mfa/verify');
    }
  }

  return <>{children}</>;
}
