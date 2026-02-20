import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { serverEnv } from '@/lib/env';

let _plaid: PlaidApi | undefined;

/**
 * Lazily initialized Plaid client. Uses the validated PLAID_CLIENT_ID,
 * PLAID_SECRET, and PLAID_ENV from server environment variables.
 * Must only be called server-side.
 */
export function plaid(): PlaidApi {
  if (!_plaid) {
    const env = serverEnv();
    const configuration = new Configuration({
      basePath: PlaidEnvironments[env.PLAID_ENV],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
          'PLAID-SECRET': env.PLAID_SECRET,
        },
      },
    });
    _plaid = new PlaidApi(configuration);
  }
  return _plaid;
}
