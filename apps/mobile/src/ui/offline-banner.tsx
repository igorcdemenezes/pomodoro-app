import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useConnectionStatus } from '../net/use-connection-status';

/**
 * A persistent strip while the device has no usable connection.
 *
 * Deliberately not a toast: losing connectivity is a state, not an event, and a
 * message that disappears leaves the user guessing why nothing saves.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const { isConnected, isInternetReachable } = useConnectionStatus();

  // `isInternetReachable` is null until the first probe resolves; treating that
  // as offline would flash the banner on every cold start.
  const offline = !isConnected || isInternetReachable === false;

  if (!offline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.colors.errorContainer }]}>
      <Text variant="labelLarge" style={{ color: theme.colors.onErrorContainer }}>
        Offline — changes will sync when you reconnect
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' },
});
