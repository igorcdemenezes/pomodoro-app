import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
// Imported file by file rather than from each family's index: the index
// re-exports every weight it ships, and requiring it drops all eight Manrope
// and all five Space Grotesk faces into the bundle when six are ever drawn.
import Manrope_400Regular from '@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf';
import Manrope_500Medium from '@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf';
import Manrope_600SemiBold from '@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf';
import Manrope_700Bold from '@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf';
import SpaceGrotesk_500Medium from '@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf';
import SpaceGrotesk_700Bold from '@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf';
import { useFonts } from 'expo-font';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '../src/auth/auth-store';
import { startFocusManager } from '../src/net/app-focus';
import { startOnlineManager } from '../src/net/online-manager';
import { startSessionNotifications } from '../src/sessions/session-notification';
import { queryClient, queryPersister } from '../src/query/query-client';
import { theme } from '../src/theme/theme';
import { color } from '../src/theme/tokens';
import { OfflineChrome } from '../src/ui/offline-chrome';
import { RouteGuard } from '../src/auth/route-guard';

// Held until the type is ready. The alternative is a first frame in the system
// font at the system's metrics, which then reflows into Manrope — on the timer
// that is a 76px number visibly changing shape.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  // Registered once for the process: React Query otherwise assumes a browser,
  // and never learns that the connection dropped or that the app was put away.
  useEffect(() => {
    startOnlineManager();
    startSessionNotifications();

    return startFocusManager();
  }, []);

  // Reading the keystore is what makes a returning user land in the app rather
  // than on the sign-in screen.
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // A font that fails to decode must not cost the user the app; the system
  // face is a worse frame than Manrope, not a broken one.
  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <PaperProvider theme={theme}>
        <SafeAreaProvider style={styles.chrome}>
          <StatusBar style="dark" />
          <OfflineChrome>
            <RouteGuard>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: color.canvas },
                }}
              >
                {/* All three are named, in order, on purpose: Expo Router puts the
                    screens a layout declares ahead of the ones it only found on
                    disk, and the first screen in a stack is where the navigator
                    lands when it has no route to restore. Declaring only
                    `server-settings` — the one screen that needed options — made
                    the server form that fallback, so the app opened on it with
                    nothing underneath and its back button had nowhere to go. */}
                <Stack.Screen name="(app)" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="server-settings" options={{ presentation: 'modal' }} />
              </Stack>
            </RouteGuard>
          </OfflineChrome>
        </SafeAreaProvider>
      </PaperProvider>
    </PersistQueryClientProvider>
  );
}

const styles = StyleSheet.create({
  chrome: { flex: 1, backgroundColor: color.canvas },
});
