import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions, TextInputProps } from 'react-native';

import { color, font, radius, size } from '../theme/tokens';
import { Icon } from './icon';
import { RoundButton } from './button';
import { Text } from './text';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** A real validation failure. Red is the brand here, so it only ever appears
   *  on a field that is actually wrong — never as ordinary emphasis. */
  error?: string;
  /** Standing guidance, shown whether or not anything is wrong. */
  hint?: string;
  placeholder?: string;
  secure?: boolean;
  /** Adds the reveal toggle; only meaningful with `secure`. */
  revealable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  editable?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: TextInputProps['returnKeyType'];
  autoFocus?: boolean;
  maxLength?: number;
}

export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  secure = false,
  revealable = false,
  keyboardType,
  autoComplete,
  autoCapitalize = 'none',
  editable = true,
  onSubmitEditing,
  returnKeyType,
  autoFocus,
  maxLength,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.field}>
      <Text variant="overline" tone={error ? 'accent' : focused ? 'primary' : 'secondary'}>
        {label.toUpperCase()}
      </Text>

      <View
        style={[
          styles.box,
          // Focus is a neutral heavier border, not a red one: red is reserved
          // for a field that has actually gone wrong.
          focused && !error && styles.focused,
          error ? styles.errored : null,
        ]}
      >
        <TextInput
          style={styles.input}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={color.inkSecondary}
          secureTextEntry={secure && !revealed}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          autoFocus={autoFocus}
          maxLength={maxLength}
          selectionColor={color.accent}
        />

        {secure && revealable ? (
          <RoundButton
            icon={revealed ? 'eyeOff' : 'eye'}
            iconSize={22}
            tint={color.inkSecondary}
            strokeWidth={1.6}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((shown) => !shown)}
          />
        ) : null}
      </View>

      {error ? (
        <View style={styles.helper}>
          <Icon name="alert" size={16} color={color.accent} strokeWidth={2} />
          <Text variant="label" tone="accent" style={styles.helperText}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="label" tone="secondary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A whole number the user nudges rather than types.
 *
 * Session lengths are picked from a handful of sensible values, so a keyboard
 * is the wrong instrument: it invites `0`, `999` and a validation round trip
 * for something the buttons can simply refuse to produce.
 */
export function Stepper({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text variant="bodyStrong" style={styles.stepperLabel}>
        {label}
      </Text>
      <RoundButton
        icon="minus"
        diameter={size.chip}
        iconSize={16}
        strokeWidth={2.2}
        background={color.control}
        tint={color.inkSecondary}
        disabled={value <= min}
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(Math.max(min, value - step))}
      />
      <Text variant="numeralSm" style={styles.stepperValue}>
        {display}
      </Text>
      <RoundButton
        icon="plus"
        diameter={size.chip}
        iconSize={16}
        strokeWidth={2.2}
        background={color.control}
        tint={color.inkSecondary}
        disabled={value >= max}
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  box: {
    minHeight: size.control,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: color.cardBorder,
    backgroundColor: color.surface,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  focused: { borderWidth: 1.5, borderColor: color.ink, paddingLeft: 15.5, paddingRight: 7.5 },
  errored: { borderColor: color.accent },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 16,
    lineHeight: 22,
    color: color.ink,
    paddingVertical: 16,
  },
  helper: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  helperText: { flex: 1 },
  stepper: {
    minHeight: 60,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperLabel: { flex: 1 },
  stepperValue: { width: 60, textAlign: 'center' },
});
