import { useState } from "react";
import { Building2, Download, MapPin, Plus } from "lucide-react";
import { useApp } from "@/context";
import { cn, colorClasses } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PropertyDialog } from "./property-dialog";
import type { Property } from "@/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { tf } from "@/i18n";
import { downloadCsv } from "@/api";

export function PropertiesList({ navigate }: { navigate: (to: string) => void }) {
  const app = useApp();
  const properties = app.properties;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | undefined>(undefined);

  // Profile-owned property-geography columns, joined in the profile's order
  // so the address line matches the CSV export order.
  const geoColumns = app.profile.geo.columns;
  const geoValuesFor = (p: Property): (string | null)[] => {
    const rec = p as unknown as Record<string, unknown>;
    return geoColumns.map((col) => (typeof rec[col] === "string" ? (rec[col] as string) : null));
  };
  const geoLine = (p: Property) => [p.address, ...geoValuesFor(p), p.country, p.city, p.state].filter(Boolean).join(", ");

  const totalUnits = properties.reduce((sum, p) => sum + (p.unit_count ?? 0), 0);
  const occupied = properties.reduce((sum, p) => sum + (p.occupied_count ?? 0), 0);

  return (
    <PageShell
      title={tf("properties.title")}
      meta={`${tf(properties.length === 1 ? "common.properties_n" : "common.properties_n_plural", properties.length)} · ${tf(totalUnits === 1 ? "common.units_n" : "common.units_n_plural", totalUnits)} · ${tf("common.occupied_of", occupied, totalUnits || 0)}`}
      actions={
        <>
          <Button variant="secondary" onClick={() => downloadCsv(`/api/export/properties?filename=${encodeURIComponent(tf("export.properties_filename"))}`, tf("export.properties_filename"))}>
            <Download className="h-4 w-4" /> {tf("export.button")}
          </Button>
          <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            {tf("properties.new")}
          </Button>
        </>
      }
    >
      {properties.length === 0 ? (
          <EmptyState icon={<Building2 className="size-8" />} title={tf("properties.no_properties")} description={tf("properties.empty_desc")} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => {
              const palette = colorClasses(p.color);
              const occRate = p.unit_count
                ? Math.round(((p.occupied_count ?? 0) / p.unit_count) * 100)
                : 0;
              return (
                <Card
                  key={p.id}
                  className={cn(
                    "group relative cursor-pointer overflow-hidden p-5 transition-colors duration-150 hover:bg-muted",
                  )}
                  onClick={() => navigate(`/properties/${p.id}`)}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className={cn("flex size-10 items-center justify-center rounded-md", palette.bg, palette.text)}>
                      <Building2 className="size-5" />
                    </div>
                    <span className="chip">
                      {tf(`property_type.${p.type}`)}
                    </span>
                  </div>
                  <h3 className="font-semibold tracking-tight">{p.name}</h3>
                  {(p.address || p.city || geoValuesFor(p).some(Boolean)) && (
                    <p className="mt-1 flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {geoLine(p)}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
                    <Stat label={tf("properties.units")} value={p.unit_count ?? 0} />
                    <Stat label={tf("properties.occupied")} value={`${p.occupied_count ?? 0}/${p.unit_count ?? 0}`} />
                    <Stat label={tf("properties.occupancy")} value={`${occRate}%`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setEditing(p); setDialogOpen(true); }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {tf("common.edit")}
                    </button>
                    {p.year_built && (
                      <span className="text-xs text-muted-foreground">{tf("properties.built", p.year_built)}</span>
                    )}
                  </div>
                </Card>
              );
          })}
        </div>
      )}

      <PropertyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        property={editing}
      />
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="mt-0.5 text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}