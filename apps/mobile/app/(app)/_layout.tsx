import { Stack } from 'expo-router';

/**
 * Signed-in area. The tab bar arrives with the remaining feature screens; a
 * stack keeps navigation working until then.
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="focus" options={{ headerShown: true, title: 'Focus' }} />
    </Stack>
  );
}
