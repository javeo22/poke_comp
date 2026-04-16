/**
 * Routes where an EthicalAds slot may render below main content.
 *
 * Ads appear only on public content pages (pokedex, meta, reference data).
 * Auth-gated tools, settings, auth flow, and legal pages are excluded to
 * respect scan-speed UX and avoid placing ads on sensitive routes.
 */
export const AD_ALLOWED_ROUTES: string[] = [
  "/",
  "/pokemon",
  "/meta",
  "/moves",
  "/items",
  "/type-chart",
  "/speed-tiers",
  "/calc",
  "/u",
  "/share",
];

export function isAdRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return AD_ALLOWED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}
