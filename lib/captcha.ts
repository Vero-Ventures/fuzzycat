import { serverEnv } from './env';
import { logger } from './logger';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verify a Cloudflare Turnstile CAPTCHA token server-side.
 *
 * Calls the Turnstile siteverify endpoint with the provided token
 * and the secret key from TURNSTILE_SECRET_KEY env var.
 *
 * @returns true if the token is valid, false otherwise.
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
  const secretKey = serverEnv().TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    logger.error('verifyCaptcha: TURNSTILE_SECRET_KEY is not configured');
    return false;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      logger.error(`verifyCaptcha: HTTP ${response.status} from Turnstile API`);
      return false;
    }

    const data: TurnstileVerifyResponse = await response.json();
    if (!data.success) {
      logger.warn('Turnstile CAPTCHA verification failed', {
        errorCodes: data['error-codes'],
      });
    }
    return data.success;
  } catch (error) {
    logger.error('verifyCaptcha: Network error', { error });
    return false;
  }
}
