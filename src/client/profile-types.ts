/**
 * Core profile contract — the shape a product profile must satisfy to be
 * composed with the core. The core only ever consumes values through these
 * interfaces; it never imports a profile module.
 */
import type { ComponentType } from "react";

/** Props the core passes to a profile-supplied property-geography form slot. */
export interface GeoFieldProps {
  /** Current values keyed by `geo.columns` entry (raw, possibly empty). */
  value: Record<string, string | null>;
  /** Push a new field set up to the dialog (the core normalizes at save). */
  onChange: (next: Record<string, string | null>) => void;
}

/** Build-shell metadata applied by the deployment entry (main.tsx) at startup. */
export interface ProfileShell {
  lang: string;
  title: string;
  metaDescription: string;
  /** Extra webfont <link> (e.g. an Arabic face) appended to <head>. */
  fontsHref?: string;
}

export interface ProfileLocales {
  /** Locale ids beyond the core's English base, in picker display order. */
  ids: readonly string[];
  /** Catalogs keyed by locale id; the core merges them over its English base. */
  catalogs: Record<string, Record<string, unknown>>;
  /** Locales whose UI renders right-to-left (`dir="rtl"`). */
  rtlLocales: readonly string[];
}

export interface ProductProfile {
  id: string;
  name: string;
  defaults: {
    /** Developer-controlled settings defaults (user overrides win at runtime). */
    settings: Record<string, string>;
    /** Default value for the property form's country field. */
    country: string;
  };
  locales: ProfileLocales;
  geo: {
    /** Property-geography column names, in display order (CSV + address join). */
    columns: readonly string[];
    /** Optional form widget for the property dialog's geo slot. */
    component?: ComponentType<GeoFieldProps>;
  };
  shell: ProfileShell;
}