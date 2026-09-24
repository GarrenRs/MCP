import en from "./en.json";

/**
 * Core i18n. Ships with English only (`en`); product profiles register their
 * own locales and catalogs through `registerLocales` / `registerCatalogs`
 * before the UI mounts (see src/client/main.tsx). English stays the fallback
 * for every locale, so a missing translation degrades to English, then to the
 * key itself.
 */
export type Locale = string;

const CATALOGS: Record<string, Record<string, unknown>> = { en };

const DEFAULT_LOCALE: Locale = "en";
const SUPPORTED_LOCALES: Locale[] = ["en"];

let currentLocale: Locale = DEFAULT_LOCALE;

/** Declare a locale id as supported (unknown ids fall back to the default). */
export function registerLocales(ids: readonly string[]): void {
  for (const id of ids) {
    if (!SUPPORTED_LOCALES.includes(id)) SUPPORTED_LOCALES.push(id);
  }
}

/** Deep-merge catalogs into the registry (profile catalogs overlay the core
 *  English base, so partial catalog fragments are fine). */
export function registerCatalogs(catalogs: Record<string, Record<string, unknown>>): void {
  for (const [locale, catalog] of Object.entries(catalogs)) {
    CATALOGS[locale] = deepMerge(CATALOGS[locale] ?? en, catalog);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const existing = out[key];
    out[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return out;
}

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value);
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