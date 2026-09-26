import { createContext, useContext } from "react";
import type { AppStateValue } from "./hooks/use-app-state";
import type { ProductProfile } from "./profile-types";

export interface AppValue extends AppStateValue {
  /** The composed product profile (settings defaults, geo slot, locales…). */
  profile: ProductProfile;
  /**
   * Read-only session capability list surfaced by the server (presentation
   * gating only — the server remains authoritative). `null` means there is no
   * auth session (auth disabled or logged out): the UI then presents every
   * control, exactly as the auth-off runtime behaves.
   */
  capabilities: string[] | null;
}

export const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext.Provider");
  return ctx;
}

/**
 * Presentation gating helper: with no session (`null`) every control is shown;
 * with a session, a control is shown only when the capability is present.
 * Never treated as enforcement.
 */
export function hasCap(capabilities: string[] | null, cap: string): boolean {
  return capabilities === null || capabilities.includes(cap);
}