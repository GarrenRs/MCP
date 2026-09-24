import { createContext, useContext } from "react";
import type { AppStateValue } from "./hooks/use-app-state";
import type { ProductProfile } from "./profile-types";

export interface AppValue extends AppStateValue {
  /** The composed product profile (settings defaults, geo slot, locales…). */
  profile: ProductProfile;
}

export const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext.Provider");
  return ctx;
}