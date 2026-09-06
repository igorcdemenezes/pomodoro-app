import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { color, radius, size } from '../theme/tokens';
import { Icon } from './icon';
import type { IconName } from './icon';
import { Text } from './text';

type Variant = 'filled' | 'tonal' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const INK: Record<Variant, string> = {
  filled: color.onAccent,
  tonal: color.accent,
  ghost: color.accent,
};

/**
 * The full-width action at the bottom of a screen.
 *
 * Three weights and no more: the red fill is the one thing to do here, the
 * tinted fill is the destructive-but-expected one (signing out), and the ghost
 * is a link that happens to be laid out as a row.
 */
export function Button({
  label,
  onPress,
  variant = 'filled',
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const inert = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'filled' && styles.filled,
        variant === 'tonal' && styles.tonal,
        variant === 'ghost' && styles.ghost,
        // Disabled fades the whole control rather than recolouring it: a red
        // that only *looks* muted would still read as the brand.
        inert && styles.inert,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={INK[variant]} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={INK[variant]} strokeWidth={2} /> : null}
          <Text variant="button" color={INK[variant]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

interface RoundButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  diameter?: number;
  iconSize?: number;
  background?: string;
  tint?: string;
  strokeWidth?: number;
  disabled?: boolean;
  /** Grows the touch target without growing the mark. */
  hitSlop?: number;
}

/**
 * A circular icon button — the play affordance on a row, a stepper, the
 * controls under the timer.
 *
 * Several are drawn smaller than 44px because the layout needs them to be; they
 * reach the touch target through `hitSlop` instead. The visual size is
 * deliberate, the target is not negotiable.
 */
export function RoundButton({
  icon,
  onPress,
  accessibilityLabel,
  diameter = 40,
  iconSize = 20,
  background = 'transparent',
  tint = color.inkIcon,
  strokeWidth = 2,
  disabled = false,
  hitSlop,
}: RoundButtonProps) {
  const slop = hitSlop ?? Math.max(0, (size.touch - diameter) / 2);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.round,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: background,
        },
        disabled && styles.inert,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={iconSize} color={tint} strokeWidth={strokeWidth} />
    </Pressable>
  );
}

/** An inline action set in the accent: "Create an account", "History ›". */
export function TextButton({
  label,
  onPress,
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => [styles.textButton, (pressed || disabled) && styles.pressed]}
    >
      <Text variant="labelStrong" tone="accent">
        {label}
      </Text>
      {icon ? <Icon name={icon} size={16} color={color.accent} strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** The strip that separates two blocks inside a card or a list. */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.hairline, style]} />;
}

const styles = StyleSheet.create({
  button: {
    height: size.control,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  filled: { backgroundColor: color.accent },
  tonal: { backgroundColor: color.accentContainer, height: 52 },
  ghost: { backgroundColor: 'transparent' },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  round: { alignItems: 'center', justifyContent: 'center' },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hairline: { height: 1, backgroundColor: color.hairline },
});
