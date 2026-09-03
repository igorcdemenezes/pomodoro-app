import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface ConnectionStatus {
  isConnected: boolean;
  /** Null while the first reachability probe is still running. */
  isInternetReachable: boolean | null;
  type: string;
}

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: 'unknown',
  });

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setStatus({
          isConnected: state.isConnected ?? false,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
        });
      }),
    [],
  );

  return status;
}
