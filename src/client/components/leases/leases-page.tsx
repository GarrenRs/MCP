import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { useApp } from "@/context";
import { cn, daysBetween, formatDate, formatMoney, toIsoDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaseDialog } from "./lease-dialog";
import type { Lease, LeaseStatus } from "@/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { tf } from "@/i18n";

const STATUS_TONE: Record<string, string> = {
  active: "tone-success",
  upcoming: "tone-info",
  ended: "tone-neutral",
  cancelled: "tone-neutral",
};

export function LeasesPage({ navigate }: { navigate: (to: string) => void }) {
  const app = useApp();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeaseStatus | "all">("active");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lease | undefined>(undefined);

  async function load() {
    try {
      setLoading(true);
      const list = await app.listLeases();
      setLeases(list);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    let out = leases;
    if (filter !== "all") out = out.filter((l) => l.status === filter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter((l) =>
        `${l.tenant_first_name ?? ""} ${l.tenant_last_name ?? ""} ${l.property_name ?? ""} ${l.unit_name ?? ""}`.toLowerCase().includes(needle),
      );
    }
    return out;
  }, [leases, filter, q]);

  return (
    <PageShell
      title={tf("leases.title")}
      meta={tf("leases.meta", leases.length, leases.filter((l) => l.status === "active").length)}
      actions={
        leases.length > 0 ? (
          <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> {tf("leases.new")}
          </Button>
        ) : null
      }
    >

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as LeaseStatus | "all")}>
            <TabsList>
              <TabsTrigger value="active">{tf("lease_status.active")}</TabsTrigger>
              <TabsTrigger value="upcoming">{tf("lease_status.upcoming")}</TabsTrigger>
              <TabsTrigger value="ended">{tf("lease_status.ended")}</TabsTrigger>
              <TabsTrigger value="all">{tf("maintenance.all")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={tf("leases.search")} className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{tf("common.loading")}</Card>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText className="size-7" />} title={tf("leases.no_leases")} />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tf("leases.tenant")}</TableHead>
                  <TableHead>{tf("leases.property_unit")}</TableHead>
                  <TableHead>{tf("leases.term")}</TableHead>
                  <TableHead className="text-end">{tf("leases.rent")}</TableHead>
                  <TableHead>{tf("leases.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const today = toIsoDate(new Date());
                  const daysToEnd = daysBetween(today, l.end_date);
                  const ending = l.status === "active" && daysToEnd >= 0 && daysToEnd <= 30;
                  return (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer"
                      onClick={() => { setEditing(l); setDialogOpen(true); }}
                    >
                      <TableCell>
                        {l.primary_tenant_id ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/tenants/${l.primary_tenant_id}`); }}
                            className="text-start font-medium hover:underline"
                          >
                            {l.tenant_first_name} {l.tenant_last_name}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{tf("common.no_tenant")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          <span className="text-muted-foreground">{l.property_name}</span>
                          <span className="px-1 text-muted-foreground/40">·</span>
                          <span className="font-medium">{l.unit_name}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(l.start_date)} → {formatDate(l.end_date)}</div>
                        {ending && <div className="text-xs text-warning">{tf("common.ends_in_days", daysToEnd)}</div>}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(l.monthly_rent, app.settings.currency)}{tf("common.per_month")}</TableCell>
                      <TableCell>
                        <span className={cn("badge-tone capitalize", STATUS_TONE[l.status] ?? "tone-neutral")}>
                          {tf(`lease_status.${l.status}`)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

      <LeaseDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) load(); }}
        lease={editing}
      />
    </PageShell>
  );
}
