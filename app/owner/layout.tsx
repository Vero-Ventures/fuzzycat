import { redirect } from 'next/navigation';
import { PortalFooter } from '@/components/shared/portal-footer';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';
import { OwnerNavbar } from './_components/owner-navbar';

export const dynamic = 'force-dynamic';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromMiddleware();

  if (!auth || (auth.role !== 'owner' && auth.role !== 'admin')) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <OwnerNavbar />
      <main className="flex-1">{children}</main>
      <PortalFooter />
    </div>
  );
}
