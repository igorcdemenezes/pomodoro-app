import { Stack } from 'expo-router';

/**
 * Signed-in area. The tab bar arrives with the remaining feature screens; a
 * stack keeps navigation working until then.
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="focus" options={{ headerShown: true, title: 'Focus' }} />
      <Stack.Screen name="projects" options={{ headerShown: true, title: 'Projects' }} />
      <Stack.Screen name="tasks" options={{ headerShown: true, title: 'Tasks' }} />
      <Stack.Screen name="statistics" options={{ headerShown: true, title: 'Statistics' }} />
      <Stack.Screen name="history" options={{ headerShown: true, title: 'History' }} />
    </Stack>
  );
}
