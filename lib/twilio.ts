import Twilio from 'twilio';
import { serverEnv } from '@/lib/env';

type TwilioClient = ReturnType<typeof Twilio>;

let _twilio: TwilioClient | undefined;

/**
 * Lazily initialized Twilio client. Uses the validated TWILIO_ACCOUNT_SID
 * and TWILIO_AUTH_TOKEN from server environment variables.
 * Must only be called server-side.
 */
export function twilio(): TwilioClient {
  if (!_twilio) {
    const env = serverEnv();
    _twilio = Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return _twilio;
}
