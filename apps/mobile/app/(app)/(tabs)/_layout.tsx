import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../../src/ui/tab-bar';

/**
 * The five tabs, drawn by `TabBar`.
 *
 * The navigator keeps the routing and the state; everything visible is ours,
 * because the selected state in the design is a tinted pill behind the icon
 * alone, which the stock bar cannot express.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="projects" options={{ title: 'Projects' }} />
      <Tabs.Screen name="focus" options={{ title: 'Focus' }} />
      <Tabs.Screen name="statistics" options={{ title: 'Stats' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
