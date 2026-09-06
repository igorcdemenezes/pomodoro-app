import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, radius, size } from '../theme/tokens';
import { Icon } from './icon';
import type { IconName } from './icon';
import { Text } from './text';

/**
 * The five places the app can be, always visible.
 *
 * Hand-drawn rather than configured, because the selected state is a tinted
 * pill *behind the icon only* — the label stays on the canvas and merely
 * changes ink. A stock tab bar draws the indicator around the whole item, which
 * at this height reads as a button rather than as a place.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bar, { height: size.tabBar + insets.bottom, paddingBottom: insets.bottom }]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={styles.item}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <Icon
                name={ICONS[route.name] ?? 'home'}
                size={22}
                color={focused ? color.accent : color.inkIcon}
              />
            </View>
            <Text variant="tab" tone={focused ? 'accent' : 'secondary'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const ICONS: Record<string, IconName> = {
  index: 'home',
  projects: 'folder',
  focus: 'timer',
  statistics: 'bars',
  profile: 'person',
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: color.canvas,
    borderTopWidth: 1,
    borderTopColor: color.hairline,
  },
  item: { flex: 1, alignItems: 'center', gap: 6 },
  pill: {
    width: 44,
    height: 28,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: color.accentContainer },
});
