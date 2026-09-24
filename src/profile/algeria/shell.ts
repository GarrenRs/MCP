/**
 * Algeria profile — build-shell metadata.
 *
 * The core ships a neutral shell (index.html). The deployment entry
 * (src/client/main.tsx) applies these values at startup, so the built product
 * carries the profile's language, title, meta description and font loading
 * without the core knowing anything about them.
 */
export const shell = {
  lang: "fr",
  title: "ORKESTRIX Property System",
  metaDescription:
    "Système de gestion locative pour l'Algérie — biens, unités, locataires, baux, loyers et maintenance.",
  /** Extra webfont link appended to <head> (Cairo for the Arabic UI). */
  fontsHref: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap",
} as const;