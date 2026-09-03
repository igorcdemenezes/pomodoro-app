import { Stack } from 'expo-router';

/**
 * Signed-in area. The tab bar arrives with the feature screens; a stack keeps
 * navigation working until then.
 */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
