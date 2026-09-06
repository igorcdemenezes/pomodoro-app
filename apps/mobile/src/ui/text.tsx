import type { ReactNode } from 'react';
import { Text as RNText } from 'react-native';
import type { StyleProp, TextProps as RNTextProps, TextStyle } from 'react-native';

import { color, font } from '../theme/tokens';

/**
 * The type scale, as named roles rather than sizes.
 *
 * Screens ask for `rowTitle` or `overline`, never for "16px semibold", so a
 * decision about how a row title looks is made once here instead of drifting
 * across nine screens. Every size carries its own line height and tracking:
 * large display numerals are tightened hard, small caps labels are opened up,
 * and neither reads right at the other's defaults.
 */
const VARIANTS = {
  /** Section headings: `FOCUSED TODAY`, `UP NEXT`. Always secondary ink. */
  overline: { fontFamily: font.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 1 },
  /** The session-kind chip on the timer. */
  eyebrow: { fontFamily: font.semiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },

  authTitle: { fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  pageTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  personName: { fontFamily: font.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  barTitle: { fontFamily: font.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },

  timer: {
    fontFamily: font.display,
    fontSize: 76,
    lineHeight: 78,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums' as const],
  },
  hero: {
    fontFamily: font.display,
    fontSize: 60,
    lineHeight: 66,
    letterSpacing: -2.5,
    fontVariant: ['tabular-nums' as const],
  },
  numeral: { fontFamily: font.display, fontSize: 20, lineHeight: 24 },
  numeralSm: { fontFamily: font.display, fontSize: 16, lineHeight: 20 },
  numeralXs: { fontFamily: font.display, fontSize: 15, lineHeight: 20 },
  numeralMicro: { fontFamily: font.display, fontSize: 13, lineHeight: 18 },

  /** A project card's name. */
  cardTitle: { fontFamily: font.semiBold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  /** A task or a history entry: the line the eye lands on in a list. */
  rowTitle: { fontFamily: font.medium, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  /** What the user typed into a field. */
  input: { fontFamily: font.regular, fontSize: 16, lineHeight: 22 },
  /** Running prose. */
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  /** A settings row, a card heading. */
  bodyStrong: { fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  sectionHeading: { fontFamily: font.semiBold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },
  /** Filled and tonal buttons. */
  button: { fontFamily: font.bold, fontSize: 15, lineHeight: 20, letterSpacing: -0.1 },

  label: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  /** Chips, inline links, the strong half of a pair. */
  labelStrong: { fontFamily: font.semiBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  captionStrong: { fontFamily: font.semiBold, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: font.regular, fontSize: 11, lineHeight: 14 },
  /** The caps under the timer's round buttons. */
  control: { fontFamily: font.semiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  tab: { fontFamily: font.semiBold, fontSize: 10, lineHeight: 12, letterSpacing: 0.4 },
  badge: { fontFamily: font.bold, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof VARIANTS;

const TONES = {
  primary: color.ink,
  secondary: color.inkSecondary,
  accent: color.accent,
  inverse: color.onAccent,
  positive: color.positiveInk,
} as const;

interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: keyof typeof TONES;
  /** For the one place ink is data: a session's or a project's own colour. */
  color?: string;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
}

export function Text({ variant = 'body', tone, color: ink, style, ...rest }: TextProps) {
  // `overline` is a heading for the block under it, never the block's subject,
  // so it is secondary by default rather than by every caller remembering.
  const resolved = tone ?? (variant === 'overline' ? 'secondary' : 'primary');

  return <RNText {...rest} style={[VARIANTS[variant], { color: ink ?? TONES[resolved] }, style]} />;
}
