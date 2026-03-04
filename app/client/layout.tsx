import { redirect } from 'next/navigation';
import { PortalFooter } from '@/components/shared/portal-footer';
import { getAuthFromMiddleware } from '@/lib/auth-from-middleware';
import { ClientNavbar } from './_components/client-navbar';

export const dynamic = 'force-dynamic';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthFromMiddleware();

  if (!auth || (auth.role !== 'client' && auth.role !== 'admin')) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ClientNavbar />
      <main className="flex-1">{children}</main>
      <PortalFooter />
    </div>
  );
}
