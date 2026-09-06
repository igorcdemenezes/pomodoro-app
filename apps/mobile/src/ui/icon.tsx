import type { ReactElement } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { color as tokens } from '../theme/tokens';

/**
 * The app's icons, drawn rather than imported.
 *
 * A stroke set at a single weight is part of the visual system: an icon font
 * would arrive at its own weights and optical sizes, and the tab bar, the
 * steppers and the row affordances would stop looking like one family. Every
 * glyph is on a 24 grid so `size` scales them together.
 *
 * A few are filled — play and pause read as buttons, not as outlines — so each
 * entry says which it is.
 */
const ICONS = {
  home: {
    render: (props: GlyphProps) => (
      <>
        <Rect x={3.5} y={3.5} width={7} height={7} rx={2} {...props} />
        <Rect x={13.5} y={3.5} width={7} height={7} rx={2} {...props} />
        <Rect x={3.5} y={13.5} width={7} height={7} rx={2} {...props} />
        <Rect x={13.5} y={13.5} width={7} height={7} rx={2} {...props} />
      </>
    ),
  },
  folder: { d: 'M3 7.5a2 2 0 0 1 2-2h3.6l1.8 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  timer: {
    render: (props: GlyphProps) => (
      <>
        <Path d="M12 10v3.5M9.5 3h5" {...props} />
        <Path d="M19.5 13.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0" {...props} />
      </>
    ),
  },
  bars: { d: 'M3.5 20.5h17M7 20.5v-6M12 20.5V6M17 20.5v-9' },
  person: {
    render: (props: GlyphProps) => (
      <>
        <Path d="M15.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0" {...props} />
        <Path d="M5 20a7 7 0 0 1 14 0" {...props} />
      </>
    ),
  },

  back: { d: 'M19 12H5M11 6 5 12l6 6' },
  chevronRight: { d: 'M9.5 5 16.5 12 9.5 19' },
  chevronDown: { d: 'M6 9.5 12 15.5 18 9.5' },
  arrowUp: { d: 'M12 19V6M6 12l6-6 6 6' },
  arrowDown: { d: 'M12 5v13M6 12l6 6 6-6' },

  plus: { d: 'M12 5v14M5 12h14' },
  minus: { d: 'M5 12h14' },
  close: { d: 'M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5' },
  check: { d: 'M5 12.5 10 17.5 19 7' },

  play: { d: 'M8 5.5v13l11-6.5z', filled: true },
  pause: {
    filled: true,
    render: (props: GlyphProps) => (
      <>
        <Rect x={7} y={5} width={3.6} height={14} rx={1.6} {...props} />
        <Rect x={13.4} y={5} width={3.6} height={14} rx={1.6} {...props} />
      </>
    ),
  },

  eye: {
    render: (props: GlyphProps) => (
      <>
        <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...props} />
        <Path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0" {...props} />
      </>
    ),
  },
  eyeOff: {
    render: (props: GlyphProps) => (
      <>
        <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...props} />
        <Path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0" {...props} />
        <Path d="M4 20 20 4" {...props} />
      </>
    ),
  },
  alert: {
    render: (props: GlyphProps) => (
      <>
        <Path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" {...props} />
        <Path d="M12 7.5v5.5M12 16.3h.01" {...props} />
      </>
    ),
  },
  server: {
    render: (props: GlyphProps) => (
      <>
        <Rect x={3} y={4} width={18} height={7} rx={2} {...props} />
        <Rect x={3} y={13} width={18} height={7} rx={2} {...props} />
        <Path d="M7 7.5h.01M7 16.5h.01" {...props} />
      </>
    ),
  },
  calendar: {
    render: (props: GlyphProps) => (
      <>
        <Rect x={3.5} y={5} width={17} height={15.5} rx={3} {...props} />
        <Path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" {...props} />
      </>
    ),
  },
  filter: { d: 'M4 6h16M7 12h10M10 18h4' },
  more: { d: 'M6 12h.01M12 12h.01M18 12h.01' },
  refresh: { d: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5' },
} satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;

interface GlyphProps {
  stroke?: string;
  strokeWidth?: number;
  fill: string;
  strokeLinecap?: 'round';
  strokeLinejoin?: 'round';
}

interface IconDefinition {
  d?: string;
  filled?: boolean;
  render?: (props: GlyphProps) => ReactElement;
}

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Heavier only where an icon has to hold its own against a large fill. */
  strokeWidth?: number;
}

export function Icon({ name, size = 22, color = tokens.inkIcon, strokeWidth = 1.6 }: IconProps) {
  const icon: IconDefinition = ICONS[name];

  const glyph: GlyphProps = icon.filled
    ? { fill: color }
    : {
        fill: 'none',
        stroke: color,
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {icon.render ? icon.render(glyph) : <Path d={icon.d} {...glyph} />}
    </Svg>
  );
}
