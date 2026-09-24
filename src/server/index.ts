import { createApp, resetSeedForTests } from "./app";
import { algeriaServer } from "../profile/algeria/server";

export type { ServerProfile } from "./app";

/**
 * Deployment entry (wrangler main = src/server/index.ts).
 *
 * The commercial product is Core + Product Profile — a single composed app.
 * The core factory (createApp) stays market-neutral; every market-shaped value
 * (settings defaults, property-geography columns, brand, locales, shell)
 * arrives from the profile package, so the core never imports profile data.
 *
 * The export surface is unchanged from the pre-separation entry: the default
 * Hono app plus the `resetSeedForTests` test hook.
 */
const app = createApp(algeriaServer);

export default app;
export { resetSeedForTests };