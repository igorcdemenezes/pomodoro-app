import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

import { color, font, radius, sessionColor } from './tokens';

/**
 * The Paper theme, derived from the design tokens.
 *
 * Almost everything on screen is drawn by this app's own components; Paper is
 * kept for the four things it does better than a hand-rolled version would —
 * dialogs, menus, the snackbar and the activity indicator. This theme exists so
 * those four inherit the palette and the type rather than arriving as Material
 * defaults in the middle of the screen.
 *
 * There is one theme. The design defines a single palette, and a dark mode
 * invented here would be a palette nobody checked for contrast.
 */
const fonts = configureFonts({
  config: {
    // Paper's variants each carry their own weight, which a family with real
    // weight files must not be asked to synthesise; naming the file per weight
    // is what keeps Android from faux-bolding.
    bodySmall: { fontFamily: font.regular, fontWeight: '400' },
    bodyMedium: { fontFamily: font.regular, fontWeight: '400' },
    bodyLarge: { fontFamily: font.regular, fontWeight: '400' },
    labelSmall: { fontFamily: font.semiBold, fontWeight: '400' },
    labelMedium: { fontFamily: font.semiBold, fontWeight: '400' },
    labelLarge: { fontFamily: font.semiBold, fontWeight: '400' },
    titleSmall: { fontFamily: font.semiBold, fontWeight: '400' },
    titleMedium: { fontFamily: font.semiBold, fontWeight: '400' },
    titleLarge: { fontFamily: font.display, fontWeight: '400' },
  },
});

export const theme: MD3Theme = {
  ...MD3LightTheme,
  roundness: radius.field / 4,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: color.accent,
    onPrimary: color.onAccent,
    primaryContainer: color.accentContainer,
    onPrimaryContainer: color.accent,
    secondary: color.inkSecondary,
    error: color.accent,
    onError: color.onAccent,
    errorContainer: color.accentContainer,
    onErrorContainer: color.accent,
    background: color.canvas,
    onBackground: color.ink,
    surface: color.surface,
    onSurface: color.ink,
    surfaceVariant: color.control,
    onSurfaceVariant: color.inkSecondary,
    surfaceDisabled: color.control,
    outline: color.controlBorder,
    outlineVariant: color.hairline,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: color.surface,
      level2: color.surface,
      level3: color.surface,
    },
  },
};

/**
 * The session palette as flat fills.
 *
 * Kept until the timer screen is redrawn against `sessionColor`, which pairs
 * each fill with the darker ink its label needs. Nothing new should reach for
 * it.
 */
export const sessionColors = {
  FOCUS: sessionColor.FOCUS.fill,
  SHORT_BREAK: sessionColor.SHORT_BREAK.fill,
  LONG_BREAK: sessionColor.LONG_BREAK.fill,
} as const;
