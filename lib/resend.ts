import { Resend } from 'resend';
import { serverEnv } from '@/lib/env';

let _resend: Resend | undefined;

/**
 * Lazily initialized Resend client. Uses the validated RESEND_API_KEY
 * from server environment variables. Must only be called server-side.
 */
export function resend(): Resend {
  if (!_resend) {
    _resend = new Resend(serverEnv().RESEND_API_KEY);
  }
  return _resend;
}
