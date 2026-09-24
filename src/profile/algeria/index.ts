/**
 * Algeria profile — client assembly.
 *
 * Imported by the deployment entry (src/client/main.tsx), which registers the
 * profile's catalogs, applies its shell metadata and mounts the core UI with
 * this profile. Importing this module also pulls the profile stylesheet into
 * the client bundle. The core never imports this module.
 */
import { AlgerianAddressFields } from "./client";
import { catalogs, localeIds, rtlLocales } from "./locales";
import { countryDefault, geoColumns, profileId, profileName, settingsDefaults } from "./shared";
import { shell } from "./shell";
import "./styles.css";
import type { ProductProfile } from "../../client/profile-types";

export const algeria: ProductProfile = {
  id: profileId,
  name: profileName,
  defaults: {
    settings: settingsDefaults,
    country: countryDefault,
  },
  locales: {
    ids: localeIds,
    catalogs,
    rtlLocales,
  },
  geo: {
    columns: geoColumns,
    component: AlgerianAddressFields,
  },
  shell,
};