/**
 * Algeria profile — locale catalogs.
 *
 * `catalogs` is merged over the core English base catalog by the core i18n
 * registry (see src/client/i18n). Full catalogs (ar, fr) merge over the core
 * base; the `en` fragment overlays only the keys the core base deliberately
 * does not carry (brand, geo terms, locale option labels).
 *
 * Order of `ids` mirrors the locale picker order in the settings page:
 * English first (core), then the Algeria profile's own locales.
 */
import ar from "./ar.json";
import fr from "./fr.json";
import enFragment from "./en-fragment.json";

export const localeIds = ["fr-DZ", "ar"] as const;

/** Locales that render right-to-left (the UI flips to `dir="rtl"` for these). */
export const rtlLocales = ["ar"] as const;

export const catalogs = {
  ar,
  "fr-DZ": fr,
  en: enFragment,
} as const;

export type AlgeriaLocale = (typeof localeIds)[number];