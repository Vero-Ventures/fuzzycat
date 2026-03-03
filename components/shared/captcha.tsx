'use client';

import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { Turnstile } from '@marsidev/react-turnstile';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { publicEnv } from '@/lib/env';
import { cn } from '@/lib/utils';

export interface CaptchaHandle {
  /** Execute the Turnstile challenge and return the token. Automatically resets first. */
  execute: () => Promise<string>;
  /** Reset the widget so it can be re-executed (e.g. after a failed submission). */
  reset: () => void;
}

interface CaptchaProps {
  className?: string;
}

/**
 * Turnstile CAPTCHA in deferred `execute` mode.
 *
 * The widget renders invisibly on mount but does NOT run the proof-of-work
 * challenge until `execute()` is called (typically on form submit). This
 * keeps the main thread free during page load and user interaction,
 * improving INP on mobile by ~400-600ms.
 */
export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha(
  { className },
  ref,
) {
  const siteKey = publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const turnstileRef = useRef<TurnstileInstance>(null);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    execute: () => {
      if (!siteKey) return Promise.resolve('');
      // Reset the widget before each execution to avoid stale/expired tokens
      turnstileRef.current?.reset();
      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolveRef.current = null;
          rejectRef.current = null;
          reject(new Error('Captcha verification timed out. Please try again.'));
        }, 30_000);
        resolveRef.current = (token: string) => {
          clearTimeout(timeout);
          resolve(token);
        };
        rejectRef.current = (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        };
        turnstileRef.current?.execute();
      });
    },
    reset: () => {
      turnstileRef.current?.reset();
    },
  }));

  if (!siteKey) {
    return null;
  }

  return (
    <div className={cn('flex justify-center', className)}>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        onSuccess={(token) => resolveRef.current?.(token)}
        onError={() => rejectRef.current?.(new Error('Captcha verification failed'))}
        options={{
          theme: 'auto',
          size: 'compact',
          execution: 'execute',
          appearance: 'execute',
        }}
      />
    </div>
  );
});
