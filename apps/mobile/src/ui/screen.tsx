import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, gutter, size } from '../theme/tokens';
import { RoundButton } from './button';
import type { IconName } from './icon';
import { Text } from './text';

interface ScreenProps {
  children: ReactNode;
  /** A `HeaderBar`, drawn above the gutter and outside any scroll area. */
  header?: ReactNode;
  scrollable?: boolean;
  /** Off for screens inside the tab navigator, which pays the bottom inset. */
  bottomInset?: boolean;
  /** Off when the screen owns its own padding — a full-bleed list, say. */
  padded?: boolean;
  /**
   * Accepted and ignored while the screens are being redrawn one at a time.
   * None of them has a navigator header any more, so the top inset is always
   * this component's to draw; the prop goes when the last caller stops passing
   * it.
   */
  ignoreTopInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * The canvas, the safe area and the gutter, decided once.
 *
 * Every screen is drawn without a navigator header, so the top inset is this
 * component's job; the bottom one belongs to whoever is at the bottom, which is
 * the tab bar on five screens and the screen itself on the rest.
 */
export function Screen({
  children,
  header,
  scrollable = false,
  bottomInset = true,
  padded = true,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const frame = {
    paddingTop: insets.top,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
  const content = [padded && styles.padded, contentStyle];
  // The gutter belongs to the screen either way; the inset is the extra the
  // hardware asks for, and the tab bar pays it on the screens that have one.
  const bottom = {
    paddingBottom: (padded ? gutter : 0) + (bottomInset ? insets.bottom : 0),
  };

  return (
    <View style={[styles.canvas, frame]}>
      {header}
      {scrollable ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.grow, content, bottom]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, content, bottom]}>{children}</View>
      )}
    </View>
  );
}

interface HeaderBarProps {
  title?: string;
  onBack?: () => void;
  /** A 44px control — often a menu anchor, which is why it is a node. */
  action?: ReactNode;
}

/**
 * The 56px strip above a pushed screen.
 *
 * Only screens reached from somewhere else get one — the five tab screens open
 * with their own title in the page type, which is bigger and says the same
 * thing without spending a row on it.
 */
export function HeaderBar({ title, onBack, action }: HeaderBarProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <RoundButton
          icon="back"
          diameter={size.touch}
          iconSize={22}
          strokeWidth={1.8}
          tint={color.ink}
          accessibilityLabel="Go back"
          onPress={onBack}
        />
      ) : (
        <View style={styles.spacer} />
      )}

      <Text variant="barTitle" style={styles.headerTitle} numberOfLines={1}>
        {title ?? ''}
      </Text>

      {action ?? <View style={styles.spacer} />}
    </View>
  );
}

/** The 44px control that goes in a `HeaderBar`'s action slot. */
export function HeaderAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <RoundButton
      icon={icon}
      diameter={size.touch}
      iconSize={22}
      strokeWidth={1.8}
      tint={color.inkSecondary}
      accessibilityLabel={label}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: color.canvas },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  padded: { paddingHorizontal: gutter, paddingTop: 16 },
  header: {
    height: size.headerBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  headerTitle: { flex: 1 },
  spacer: { width: size.touch, height: size.touch },
});
