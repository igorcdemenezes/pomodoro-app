import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

/**
 * Back, for a screen that may be the bottom of the stack.
 *
 * A screen that was pushed has something to go back to. The same screen opened
 * from a link, or picked by the router on a cold start, is the whole stack, and
 * `back()` there does nothing but log "The action 'GO_BACK' was not handled by
 * any navigator" — leaving the user on a screen whose only exit is a no-op.
 *
 * The fallback is where the screen would have been reached from, so the button
 * means the same thing either way.
 */
export function useGoBack(fallback: Href) {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
