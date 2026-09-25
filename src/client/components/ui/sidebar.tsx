import type { ReactNode } from "react";
import { TileIcon, type AppNavItem } from "@clawnify/app/client";
import logoUrl from "../../../../logo.png";
import { t } from "../../i18n";
import { Bidi } from "./bidi";

interface SidebarGroup {
  label?: string;
  items: AppNavItem[];
}

interface SidebarProps {
  groups: SidebarGroup[];
  active: string;
  onNavigate: (item: AppNavItem) => void;
  children?: ReactNode;
}

/**
 * One row in the standalone rail: a coloured type tile, its label and, when
 * present, a live count. Mirrors the platform <AppNav> row contract so the two
 * never drift — same tiles (TileIcon), same href/button split, same active row.
 */
function SidebarRow({
  item,
  active,
  onNavigate,
}: {
  item: AppNavItem;
  active: boolean;
  onNavigate: (item: AppNavItem) => void;
}) {
  const body = (
    <>
      <TileIcon icon={item.icon} color={item.color} seed={item.id} />
      <span className="app-sidebar-label">{item.label}</span>
      {typeof item.count === "number" && <span className="app-sidebar-count">{item.count}</span>}
    </>
  );
  if (item.href) {
    return (
      <a
        href={item.href}
        className="app-sidebar-item"
        data-active={active || undefined}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          onNavigate(item);
        }}
      >
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      className="app-sidebar-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      onClick={() => onNavigate(item)}
    >
      {body}
    </button>
  );
}

/**
 * The app's own sidebar, painted where the platform <AppNav> would draw its
 * standalone rail. The two are mutually exclusive: inside the Clawnify host the
 * host paints the navigation itself (<AppNav> renders null there and only
 * bridges nav/location messages), and outside it this component paints the
 * brand row, the nav groups and the account footer. It reuses the platform's
 * tile icons and the same group/item contract, so switching shells never
 * changes the information architecture.
 *
 * The brand row keeps the platform's 56px height so its bottom rule forms one
 * continuous line with the page toolbar's rule across the shell (DESIGN.md →
 * Layout, "The shell"). Inside it the ORKESTRIX logo lockup is the primary
 * mark, and "Property System" is the quiet secondary descriptor.
 */
export function Sidebar({ groups, active, onNavigate, children }: SidebarProps) {
  const home = groups.flatMap((g) => g.items).find((i) => i.home);
  const brand = (
    <>
      <img
        src={logoUrl}
        alt="ORKESTRIX"
        className="app-sidebar-logo"
        width={1774}
        height={887}
      />
      <span className="app-sidebar-descriptor">
        <Bidi dir="ltr">{t("app.descriptor")}</Bidi>
      </span>
    </>
  );
  return (
    <aside className="app-sidebar">
      {home ? (
        <a
          href={home.href ?? "/"}
          className="app-sidebar-brand"
          data-active={home.id === active || undefined}
          aria-current={home.id === active ? "page" : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onNavigate(home);
          }}
        >
          {brand}
        </a>
      ) : (
        <div className="app-sidebar-brand">{brand}</div>
      )}
      <nav className="app-sidebar-groups" aria-label="Primary">
        {groups.map((g, gi) => (
          <div className="app-sidebar-group" key={g.label ?? gi}>
            {g.label && <p className="app-sidebar-eyebrow">{g.label}</p>}
            {g.items
              .filter((item) => !item.home)
              .map((item) => (
                <SidebarRow
                  key={item.id}
                  item={item}
                  active={item.id === active}
                  onNavigate={onNavigate}
                />
              ))}
          </div>
        ))}
      </nav>
      {children && <div className="app-sidebar-footer">{children}</div>}
    </aside>
  );
}