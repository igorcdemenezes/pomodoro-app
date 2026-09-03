import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

/**
 * Focus, breaks and rest each get their own colour, because on the timer screen
 * the kind of session matters more than any label: a glance at the phone should
 * answer "am I working or resting" before any text is read.
 */
export const sessionColors = {
  FOCUS: '#E5484D',
  SHORT_BREAK: '#30A46C',
  LONG_BREAK: '#0091FF',
} as const;

const light: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6E56CF',
    secondary: '#30A46C',
    error: '#E5484D',
    background: '#FBFBFD',
    surface: '#FFFFFF',
    surfaceVariant: '#EFEFF3',
  },
};

const dark: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#9E8CFC',
    secondary: '#3DD68C',
    error: '#FF6369',
    background: '#141416',
    surface: '#1C1C1F',
    surfaceVariant: '#26262B',
  },
};

export const themes = { light, dark };
