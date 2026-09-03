import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { useAuthStore } from './auth-store';
import { LoadingState } from '../ui/states';

/**
 * Keeps the visible route and the session in agreement.
 *
 * The redirect runs after the tree has mounted rather than during render:
 * navigating while rendering is what produces the "attempted to navigate before
 * mounting the Root Layout" crash on a cold start.
 *
 * While the keystore is being read nothing is rendered but a spinner, otherwise
 * a returning user sees the sign-in screen flash before being sent to the app.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'hydrating') return;

    const inAuthGroup = segments[0] === '(auth)';
    // Reachable while signed out: it is how someone points the build at a
    // backend before they can sign in at all.
    const isPublicRoute = inAuthGroup || segments[0] === 'server-settings';

    if (status === 'signedOut' && !isPublicRoute) {
      router.replace('/(auth)/sign-in');
    } else if (status === 'signedIn' && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [status, segments, router]);

  if (status === 'hydrating') return <LoadingState title="Restoring your session…" />;

  return <>{children}</>;
}
