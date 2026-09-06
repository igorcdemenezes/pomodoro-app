import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { useAuthStore } from './auth-store';
import { color } from '../theme/tokens';
import { LoadingState } from '../ui/states';

/**
 * Keeps the visible route and the session in agreement.
 *
 * The redirect runs after the tree has mounted rather than during render:
 * navigating while rendering is what produces the "attempted to navigate before
 * mounting the Root Layout" crash on a cold start.
 *
 * While the keystore is being read the spinner is laid *over* the navigator
 * rather than in place of it. A returning user still never sees the sign-in
 * screen flash, and the navigator is mounted on the first render — which is
 * what Expo Router needs in order to hand it the route the app was opened at.
 * Swapping the tree out instead cost it that route, and the app came back on
 * whichever screen the stack falls back to, with no history behind it.
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

  return (
    <>
      {children}
      {status === 'hydrating' ? (
        <View style={[StyleSheet.absoluteFill, styles.veil]}>
          <LoadingState title="Restoring your session…" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: color.canvas },
});
