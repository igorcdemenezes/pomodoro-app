/**
 * Font files imported by path.
 *
 * Metro resolves a `.ttf` import to an asset handle at build time, but
 * TypeScript has no idea what one is and `expo/types` only declares images.
 * Declaring it here is what lets a single weight be imported from a font
 * package instead of its index, which would pull every weight it ships into
 * the bundle.
 */
declare module '*.ttf' {
  const asset: number;
  export default asset;
}
