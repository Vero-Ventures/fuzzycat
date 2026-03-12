'use client';

import { Calendar } from 'lucide-react';
import { useTheme } from 'next-themes';

const CALENDLY_URL = 'https://calendly.com/fuzzycatapp/30min';

export function CalendlyEmbed() {
  const { resolvedTheme } = useTheme();

  const params = new URLSearchParams({
    primary_color: '0d9488',
    hide_gdpr_banner: '1',
  });

  if (resolvedTheme === 'dark') {
    params.set('background_color', '0a0a0a');
    params.set('text_color', 'e5e5e5');
  }

  const src = `${CALENDLY_URL}?${params.toString()}`;

  return (
    <section id="book-demo" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <Calendar className="mx-auto mb-6 h-12 w-12 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Schedule a Demo</h2>
          <p className="mt-3 text-muted-foreground">
            See how FuzzyCat can help your clinic increase treatment acceptance. Book a free
            30-minute walkthrough.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-xl border shadow-sm">
          <iframe
            src={src}
            title="Schedule a demo with FuzzyCat"
            width="100%"
            height="660"
            className="border-0"
          />
        </div>
      </div>
    </section>
  );
}
