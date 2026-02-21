'use client';

import { Turnstile } from '@marsidev/react-turnstile';
import { cn } from '@/lib/utils';

interface CaptchaProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  className?: string;
}

export function Captcha({ onVerify, onError, className }: CaptchaProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  if (!siteKey) {
    return null;
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={onError}
        options={{
          theme: 'auto',
          size: 'normal',
        }}
      />
    </div>
  );
}
