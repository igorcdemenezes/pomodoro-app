import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Teaches React Query what "online" means on a device.
 *
 * Without this it assumes a browser and never learns the connection dropped, so
 * queued mutations do not fire on reconnect and failed queries do not refetch.
 *
 * `isInternetReachable` is null until the first probe resolves; treating that as
 * offline would flash an offline banner on every cold start, so it falls back to
 * `isConnected`.
 */
export function startOnlineManager(): void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isInternetReachable ?? state.isConnected ?? true);
    }),
  );
}
