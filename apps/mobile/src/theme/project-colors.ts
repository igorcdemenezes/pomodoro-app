/**
 * The colours a project can be painted with.
 *
 * These are not decoration: on the statistics screen they are the categorical
 * palette that tells one project's focus time from another's, so the set has to
 * survive colourblindness rather than merely look pleasant. The order *is* the
 * safety mechanism — the first slots taken are the ones furthest apart, and
 * consecutive slots differ in lightness as well as in hue, so a reader who sees
 * no red-green difference still sees two different bars. Slots are never
 * reordered or extended casually.
 *
 * Red is absent. It is the brand and it means FOCUS on the timer; a project
 * wearing it would claim a meaning it does not have. The palette that shipped
 * before this one also put a green next to a red separated by only ΔE 4.9 under
 * deuteranopia — two projects a colourblind reader could not tell apart at all.
 */
export const PROJECT_COLORS = [
  '#1F9A62', // green
  '#6E56CF', // violet
  '#CC7A1A', // amber
  '#2A78D6', // blue
  '#B0479B', // magenta
  '#0E8A8F', // teal
  '#7A6A55', // stone
  '#3D4C8A', // indigo
] as const;

/**
 * The colour a project is drawn in.
 *
 * Kept until the statistics breakdown is redrawn: it used to step a colour for
 * the dark palette, and there is no dark palette any more. A colour set before
 * this list — or set outside the app — is returned exactly as stored rather
 * than snapped to the nearest slot, since the stored value is the project's
 * identity and rewriting it would change what the user sees without them
 * having asked for anything.
 */
export function projectColor(color: string, _dark = false): string {
  return color;
}
