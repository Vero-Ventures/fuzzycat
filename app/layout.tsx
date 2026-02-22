import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from '@/lib/trpc/provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// CSP nonces require server-side rendering on every request.
// Static pages don't go through SSR, so Next.js can't inject nonces.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://fuzzycatapp.com'),
  title: 'FuzzyCat — Guaranteed Payment Plans for Veterinary Care',
  description:
    'Split your vet bill into easy biweekly payments. No credit check. Flat 6% fee. Clinics earn 3% on every enrollment.',
  openGraph: {
    siteName: 'FuzzyCat',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider nonce={nonce}>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
