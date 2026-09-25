/**
 * Ambient module declarations for assets the bundler imports directly.
 *
 * The standalone sidebar imports the ORKESTRIX logo lockup straight from the
 * repository root (logo.png); Vite resolves and fingerprints it, and this
 * declaration gives TypeScript the module shape it needs. Kept deliberately
 * narrow — just the asset type the app actually imports today.
 */
declare module "*.png" {
  const src: string;
  export default src;
}