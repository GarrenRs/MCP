/**
 * Deployment entry (client). Composes Core + Product Profile for the browser:
 * registers the profile's locales and catalogs, applies its build-shell
 * metadata, then mounts the profile-aware core UI.
 */
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { registerCatalogs, registerLocales } from "./i18n";
import { algeria } from "../profile/algeria";
import type { ProductProfile } from "./profile-types";
import "./styles.css";

/** Apply the profile's build-shell metadata to the neutral index.html shell. */
function applyShell(shell: ProductProfile["shell"]): void {
  document.documentElement.lang = shell.lang;
  document.title = shell.title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", shell.metaDescription);
  if (shell.fontsHref) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = shell.fontsHref;
    document.head.appendChild(link);
  }
}

// Profile locale registration must run before the first render so t()/tf()
// resolve profile keys (brand, geo terms, option labels) from the very start.
registerLocales(algeria.locales.ids);
registerCatalogs(algeria.locales.catalogs);
applyShell(algeria.shell);

createRoot(document.getElementById("app")!).render(<App profile={algeria} />);