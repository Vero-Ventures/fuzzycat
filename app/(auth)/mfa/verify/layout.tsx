import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Verify MFA | FuzzyCat',
};

export default function MfaVerifyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
