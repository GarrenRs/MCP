/**
 * Algeria profile — server-side shape.
 *
 * Consumed by the core `createApp(profile)` factory (src/server/app.ts). This
 * module must stay free of client-side imports (no React, CSS, catalogs or
 * WILAYAS) so the worker bundle stays profile-neutral apart from these values.
 */
import type { ServerProfile } from "../../server/app";
import { geoColumns, profileId, profileName, settingsDefaults } from "./shared";

export const algeriaServer: ServerProfile = {
  id: profileId,
  name: profileName,
  settingsDefaults,
  geoColumns,
};