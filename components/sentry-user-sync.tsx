'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Syncs Supabase auth state to Sentry user context.
 * Uses onAuthStateChange (which fires immediately with the current session)
 * instead of a separate getUser() network call.
 * Renders nothing — mount once near the root of the component tree.
 */
export function SentryUserSync() {
  useEffect(() => {
    const supabase = createClient();

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
