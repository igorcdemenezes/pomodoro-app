/**
 * The colours a project can be painted with.
 *
 * These are not decoration: on the statistics screen they are the categorical
 * palette that tells one project's focus time from another's, so the set has to
 * survive colourblindness rather than merely look pleasant. The hues and their
 * order come from a validated categorical palette — the ordering *is* the
 * safety mechanism, so slots are never reordered or extended casually.
 *
 * The first palette shipped here put a green next to a red that separated by
 * only ΔE 4.9 under deuteranopia: two projects a red-green colourblind reader
 * could not tell apart at all.
 */
export const PROJECT_COLORS = [
  '#2A78D6', // blue
  '#EB6834', // orange
  '#1BAF7A', // aqua
  '#EDA100', // yellow
  '#E87BA4', // magenta
  '#008300', // green
  '#4A3AA7', // violet
  '#E34948', // red
] as const;

/**
 * The same eight hues stepped for a dark surface — not an automatic lightening.
 *
 * A colour picked in light mode is stored once and read back in whichever theme
 * the reader happens to be in, so the stored value is the slot's identity and
 * this is how that slot is drawn on the dark surface. Anything unrecognised —
 * a colour from before this palette, or one set outside the app — is left
 * alone rather than guessed at.
 */
const DARK_STEPS: Record<string, string> = {
  '#2a78d6': '#3987E5',
  '#eb6834': '#D95926',
  '#1baf7a': '#199E70',
  '#eda100': '#C98500',
  '#e87ba4': '#D55181',
  '#008300': '#008300',
  '#4a3aa7': '#9085E9',
  '#e34948': '#E66767',
};

export function projectColor(color: string, dark: boolean): string {
  if (!dark) return color;

  return DARK_STEPS[color.toLowerCase()] ?? color;
}
