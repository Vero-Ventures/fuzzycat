import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
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

export const metadata: Metadata = {
  metadataBase: new URL('https://fuzzycatapp.com'),
  title: 'FuzzyCat — Flexible Payment Plans for Veterinary Care',
  description:
    'Split your vet bill into easy biweekly installments. No credit check, no interest, no hassle.',
  openGraph: {
    siteName: 'FuzzyCat',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FuzzyCat — Split Your Vet Bills Into Easy Payments',
    description:
      'Pay your vet bills over 12 weeks with no credit check and no interest. 25% deposit, then 6 biweekly installments.',
  },
};

const jsonLdData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FuzzyCat',
  url: 'https://www.fuzzycatapp.com',
  description:
    'Payment plan platform for veterinary clinics. Split vet bills into easy biweekly installments.',
});

function JsonLd() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD structured data requires innerHTML; content is a static schema with no user input
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdData }} />;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <JsonLd />
        <ThemeProvider nonce={nonce}>
          <Providers>{children}</Providers>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
