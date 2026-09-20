import en from "./en.json";
import ar from "./ar.json";
import fr from "./fr.json";

export type Locale = "en" | "ar" | "fr-DZ";

const CATALOGS: Record<Locale, unknown> = { en, ar, "fr-DZ": fr };

const DEFAULT_LOCALE: Locale = "en";
const SUPPORTED_LOCALES: Locale[] = ["en", "ar", "fr-DZ"];

let currentLocale: Locale = DEFAULT_LOCALE;

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as string[]).includes(value);
}

export function getLocale(): Locale {
  return currentLocale;
}

/** Select the active locale. Unknown values fall back to the default. */
export function setLocale(locale: string): Locale {
  currentLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  return currentLocale;
}

function lookup(catalog: unknown, dotted: string): string | undefined {
  let node: unknown = catalog;
  for (const part of dotted.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Translate a dotted key (e.g. "errors.invalid_id") in the active locale,
 * falling back to English, then to the key itself. Pass an explicit locale for
 * context-free lookups.
 */
export function t(key: string, locale?: Locale | string): string {
  const loc = locale && isSupportedLocale(locale) ? locale : currentLocale;
  return lookup(CATALOGS[loc], key) ?? lookup(CATALOGS.en, key) ?? key;
}

/** Translate a key and substitute {0}, {1}, … positional tokens in place. */
export function tf(key: string, ...args: (string | number)[]): string {
  let out = t(key);
  for (let i = 0; i < args.length; i++) {
    out = out.replace(`{${i}}`, String(args[i]));
  }
  return out;
}

/**
 * Map a server error code to a local/legacy message. Known codes resolve
 * through the catalog; anything else falls back to the server's own `error`
 * string so the legacy contract keeps working.
 */
export function resolveErrorMessage(
  code: string | undefined,
  serverMessage: string,
  locale?: Locale | string,
): string {
  if (!code) return serverMessage;
  const key = `errors.${code}`;
  const mapped = t(key, locale);
  return mapped === key ? serverMessage : mapped;
}