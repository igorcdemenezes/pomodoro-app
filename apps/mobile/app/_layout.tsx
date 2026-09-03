import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startOnlineManager } from '../src/net/online-manager';
import { queryClient, queryPersister } from '../src/query/query-client';
import { themes } from '../src/theme/theme';
import { OfflineBanner } from '../src/ui/offline-banner';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? themes.dark : themes.light;

  // Registered once for the process: React Query otherwise assumes a browser
  // and never learns the connection dropped.
  useEffect(() => {
    startOnlineManager();
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <PaperProvider theme={theme}>
        <SafeAreaProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <OfflineBanner />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          />
        </SafeAreaProvider>
      </PaperProvider>
    </PersistQueryClientProvider>
  );
}
