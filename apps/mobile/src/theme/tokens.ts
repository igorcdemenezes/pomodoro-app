/**
 * The design tokens the whole client is drawn from.
 *
 * One warm white and one red. The red is the brand — it fills buttons, marks
 * the running session and carries links — which is precisely why it cannot also
 * mean "error": a field in trouble says so with a message, and a focused field
 * is a neutral ink border. `#C8353B` is 5.0:1 on the canvas and 4.9:1 under
 * white text, so it clears AA in both roles; the lighter red it replaced failed
 * the second one at 4.3:1.
 *
 * Everything is flat. No gradients, no shadows, no images — the only effect
 * anywhere is the soft copy of the timer's arc.
 */

export const color = {
  /** Warm, not pure white: pure white next to the cards reads as a glare. */
  canvas: '#FBFAF9',
  surface: '#FFFFFF',
  /** Filled controls — steppers, secondary round buttons. */
  control: '#F2EFEB',
  /** Row separators and chart baselines. */
  hairline: '#EBE8E4',
  cardBorder: '#E3DFDA',
  /** Outlined controls need more than a card does to read as tappable. */
  controlBorder: '#C4BFB8',

  ink: '#1A1817',
  /** The floor for text: 4.8:1 on the canvas. */
  inkSecondary: '#6B6762',
  /** 3.5:1 — icons and rules only, never text. */
  inkIcon: '#8A857F',
  onAccent: '#FBFAF9',

  accent: '#C8353B',
  accentPressed: '#A82B31',
  accentContainer: '#FDEDED',
  accentContainerBorder: '#F6D3D4',

  /** Confirmation, not celebration: used for a checked task and "online". */
  positive: '#1F9A62',
  positiveInk: '#177A4D',
} as const;

/**
 * Focus, breaks and rest each get their own colour, because on the timer screen
 * the kind of session matters more than any label: a glance should answer "am I
 * working or resting" before any text is read.
 *
 * Each is a fill paired with a darker ink of the same hue. The fill carries the
 * mark — the ring, the dot, the pause button — and the ink carries the label; a
 * single value would fail one of the two roles.
 */
export const sessionColor = {
  FOCUS: { fill: '#C8353B', ink: '#C8353B', tint: '#FDEDED' },
  SHORT_BREAK: { fill: '#1F9A62', ink: '#177A4D', tint: '#E9F6EF' },
  LONG_BREAK: { fill: '#1E96DC', ink: '#1272AB', tint: '#E8F3FB' },
} as const;

/**
 * Space Grotesk carries numerals and titles, Manrope everything else. The split
 * is not decorative: the timer, the day totals and the per-project figures are
 * read as quantities, and they line up in a column only because the face that
 * draws them has tabular figures.
 */
export const font = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semiBold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  display: 'SpaceGrotesk_500Medium',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

export const radius = {
  card: 18,
  control: 16,
  field: 14,
  inner: 10,
  /** Anything taller than it is round: chips, avatars, round buttons. */
  pill: 999,
} as const;

export const size = {
  /** Buttons and text fields share one height so a form reads as one column. */
  control: 56,
  /** Chips, steppers — deliberately smaller than the 44 touch target, which
   *  they reach through hitSlop rather than by growing. */
  chip: 34,
  touch: 44,
  tabBar: 78,
  headerBar: 56,
  ring: 260,
  ringStroke: 12,
} as const;

/** The screen gutter. Every full-width screen uses it, so nothing drifts. */
export const gutter = 20;
