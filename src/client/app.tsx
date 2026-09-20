import { useEffect, useState, useCallback } from "react";
import { AppNav, reportLocation, type AppNavItem } from "@clawnify/app/client";
import { api, setOnUnauthorized } from "./api";
import { useAppState } from "./hooks/use-app-state";
import { useRouter, type Route } from "./hooks/use-router";
import { AppContext } from "./context";
import { ErrorBanner } from "./components/error-banner";
import { LoginPage } from "./components/auth/login-page";
import { DashboardPage } from "./components/dashboard/dashboard-page";
import { PropertiesList } from "./components/properties/properties-list";
import { PropertyPage } from "./components/properties/property-page";
import { TenantsList } from "./components/tenants/tenants-list";
import { TenantPage } from "./components/tenants/tenant-page";
import { LeasesPage } from "./components/leases/leases-page";
import { RentPage } from "./components/rent/rent-page";
import { MaintenancePage } from "./components/maintenance/maintenance-page";
import { SettingsPage } from "./components/settings/settings-page";
import { t } from "./i18n";

/**
 * The navigation, defined once.
 *
 * Opened directly, <AppNav> paints this as the app's own rail; inside the
 * Clawnify dashboard it paints nothing and hands the same list to the host, so
 * the user sees one nav rather than two. Every record type owns a colour and
 * keeps it on its tile wherever the type appears.
 *
 * Icons come from the platform's TILE_ICONS library — a name outside it draws
 * as a plain dot in the dashboard.
 */
const PORTFOLIO: AppNavItem[] = [
  // Not drawn as a row: the app's name opens it (the brand row standalone, the
  // app's own header in the dashboard).
  { id: "dashboard", label: "Dashboard", href: "/dashboard", home: true },
  { id: "properties", label: "Properties", href: "/properties", icon: "building-2", color: "green" },
  { id: "tenants", label: "Tenants", href: "/tenants", icon: "users", color: "blue" },
  { id: "leases", label: "Leases", href: "/leases", icon: "clipboard-list", color: "violet" },
];
const OPERATIONS: AppNavItem[] = [
  { id: "rent", label: "Rent", href: "/rent", icon: "dollar-sign", color: "amber" },
  { id: "maintenance", label: "Maintenance", href: "/maintenance", icon: "list-checks", color: "orange" },
];
const ADMIN: AppNavItem[] = [
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" },
];

/** NAV_LABELS binds the static groups to the active catalog. */
const NAV_LABELS: Record<string, string> = {
  dashboard: "nav.dashboard",
  properties: "nav.properties",
  tenants: "nav.tenants",
  leases: "nav.leases",
  rent: "nav.rent",
  maintenance: "nav.maintenance",
  settings: "nav.settings",
  operations: "nav.operations",
  admin: "nav.admin",
};

function localizeNav(groups: { label?: string; items: AppNavItem[] }[]): { label?: string; items: AppNavItem[] }[] {
  return groups.map((g) => ({
    label: g.label ? t(NAV_LABELS[g.label] ?? g.label) : undefined,
    items: g.items.map((item) => ({ ...item, label: t(NAV_LABELS[item.id] ?? item.label) })),
  }));
}

/** A record page keeps its collection's row lit. */
function activeFor(route: Route): string {
  if (route.name === "property") return "properties";
  if (route.name === "tenant") return "tenants";
  return route.name;
}

interface SessionUser {
  id: number;
  email: string;
  role: string;
  display_name: string;
}

export function App() {
  const state = useAppState();
  const { path, route, navigate } = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authEnabled, setAuthEnabled] = useState(false);

  // Handle session expiry — redirect to login on any 401
  useEffect(() => {
    setOnUnauthorized(() => {
      setSessionUser(null);
      navigate("/login");
    });
  }, [navigate]);

  // Check session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ user: SessionUser | null }>("GET", "/api/auth/session");
        setSessionUser(res.user);
      } catch {
        // Auth not available or error — treat as disabled
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // Check if auth is enabled
  useEffect(() => {
    if (!authChecked) return;
    (async () => {
      try {
        const res = await api<{ auth_enabled: boolean; has_users: boolean }>("GET", "/api/auth/status");
        setAuthEnabled(res.auth_enabled);
      } catch {
        // Auth endpoint not available — treat as disabled
      }
    })();
  }, [authChecked]);

  const handleLogout = useCallback(async () => {
    try { await api("POST", "/api/auth/logout"); } catch { /* ignore */ }
    setSessionUser(null);
    navigate("/login");
  }, [navigate]);

  const handleLogin = useCallback((user: SessionUser) => {
    setSessionUser(user);
    setAuthEnabled(true);
    navigate("/dashboard");
  }, [navigate]);

  // Lets the dashboard restore this exact screen on reload.
  useEffect(() => {
    reportLocation(path);
  }, [path]);

  // Show login page if auth enabled and not logged in
  if (authChecked && authEnabled && !sessionUser && route.name !== "login") {
    return <LoginPage onLogin={handleLogin} />;
  }

  const groups = localizeNav([
    { items: PORTFOLIO },
    { label: "operations", items: OPERATIONS },
    { label: "admin", items: ADMIN },
  ]);

  return (
    <AppContext.Provider value={state}>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground md:flex-row">
        <div className="flex shrink-0">
          <AppNav
            title={t("app.brand")}
            icon="home"
            groups={groups}
            active={activeFor(route)}
            onNavigate={(item) => navigate(item.href ?? "/dashboard")}
          >
            {authEnabled && sessionUser && (
              <div className="flex flex-col gap-1 p-2 text-xs text-muted-foreground">
                <span>{sessionUser.email}</span>
                <button className="text-left hover:underline" onClick={handleLogout}>{t("auth.logout")}</button>
              </div>
            )}
          </AppNav>
        </div>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {state.loading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              {t("app.loading")}
            </div>
          ) : (
            <>
              {route.name === "login" && <LoginPage onLogin={handleLogin} />}
              {route.name === "dashboard" && <DashboardPage navigate={navigate} />}
              {route.name === "properties" && <PropertiesList navigate={navigate} />}
              {route.name === "property" && <PropertyPage id={route.id} navigate={navigate} />}
              {route.name === "tenants" && <TenantsList navigate={navigate} />}
              {route.name === "tenant" && <TenantPage id={route.id} navigate={navigate} />}
              {route.name === "leases" && <LeasesPage navigate={navigate} />}
              {route.name === "rent" && <RentPage />}
              {route.name === "maintenance" && <MaintenancePage />}
              {route.name === "settings" && <SettingsPage currentUserRole={sessionUser?.role} />}
              {route.name === "not-found" && (
                <Placeholder title={t("app.not_found_title")} message={t("app.not_found_msg")} />
              )}
            </>
          )}
        </main>
        <ErrorBanner />
      </div>
    </AppContext.Provider>
  );
}

function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-12 text-center">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
