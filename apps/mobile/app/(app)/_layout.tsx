import { Stack } from 'expo-router';

import { color } from '../../src/theme/tokens';

/**
 * The signed-in area.
 *
 * A stack around the tabs, so Tasks and History push over the tab bar instead
 * of living in it: both are opened *from* somewhere — a project, the dashboard —
 * and a tab that is only ever reached by drilling in is a tab nobody uses.
 */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }}
    />
  );
}
