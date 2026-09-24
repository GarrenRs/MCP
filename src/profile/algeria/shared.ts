/**
 * Algeria profile — shared, framework-free data.
 *
 * This module is the single source of truth for every Algeria-shaped value the
 * product needs. The core (src/server, src/client) never imports it; the
 * deployment entry points (src/server/index.ts, src/client/main.tsx) plug it
 * into the core factory functions instead.
 */

export const profileId = "algeria" as const;
export const profileName = "Algeria" as const;

/** Defaults applied by the core settings API when a row is missing. These are
 *  developer-controlled profile defaults; the user can always override them in
 *  Instance Settings (the settings table wins at runtime). */
export const settingsDefaults: Record<string, string> = {
  currency: "DZD",
  locale: "fr-DZ",
};

/** Country default for the property form's country field. */
export const countryDefault = "DZ";

/**
 * The profile's property-geography columns, in the order the product displays
 * them. Order is contractual with current behavior:
 *   1. CSV export headers read `commune, wilaya` (see export-csv.test.ts)…
 *   2. …and the address join on the list/page reads the same order:
 *      `address, commune, wilaya, country, city, state[, zip]`.
 */
export const geoColumns = ["commune", "wilaya"] as const;