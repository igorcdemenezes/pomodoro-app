import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConnectionStatus } from '../net/use-connection-status';
import { color } from '../theme/tokens';
import { Text } from './text';

/**
 * A persistent strip while the device has no usable connection.
 *
 * Deliberately not a toast: losing connectivity is a state, not an event, and a
 * message that disappears leaves the user guessing why nothing saves.
 *
 * It wraps the app rather than sitting beside it because it takes over the top
 * safe area while it is up. Screens draw their own status-bar inset — none of
 * them has a navigator header — so the strip claims that inset and hands the
 * screens below a top of zero. Without the handover the entire app would slide
 * down by the height of the notch the moment the connection dropped.
 */
export function OfflineChrome({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useConnectionStatus();

  // `isInternetReachable` is null until the first probe resolves; treating that
  // as offline would flash the strip on every cold start.
  const offline = !isConnected || isInternetReachable === false;

  if (!offline) return <>{children}</>;

  return (
    <>
      <View style={[styles.banner, { paddingTop: insets.top + 8 }]}>
        <Text variant="labelStrong" tone="accent">
          Offline — changes will sync when you reconnect
        </Text>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: color.accentContainer,
  },
});
