'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Syncs Supabase auth state to Sentry user context.
 * When a user signs in, their email and role are set on Sentry so that
 * error reports and feedback submissions are automatically attributed.
 * Renders nothing — mount once near the root of the component tree.
 */
export function SentryUserSync() {
  useEffect(() => {
    const supabase = createClient();

    // Set user from current session (if already signed in)
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        Sentry.setUser({
          id: data.user.id,
          email: data.user.email,
          username: data.user.user_metadata?.name as string | undefined,
        });
      }
    });

    // Listen for auth state changes (sign in / sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.name as string | undefined,
        });
      } else {
        Sentry.setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
