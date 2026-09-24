import { useEffect, useMemo, useState } from "react";
import { Download, Mail, Phone, Plus, Search, Users } from "lucide-react";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TenantDialog } from "./tenant-dialog";
import type { Tenant } from "@/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { tf } from "@/i18n";
import { downloadCsv } from "@/api";

export function TenantsList({ navigate }: { navigate: (to: string) => void }) {
  const app = useApp();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const list = await app.listTenants();
      setTenants(list);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return tenants;
    const needle = q.toLowerCase();
    return tenants.filter((t) =>
      `${t.first_name} ${t.last_name} ${t.email ?? ""} ${t.phone ?? ""} ${t.active_property_name ?? ""} ${t.active_unit_name ?? ""}`.toLowerCase().includes(needle),
    );
  }, [tenants, q]);

  return (
    <PageShell
      title={tf("tenants.title")}
      meta={tf(tenants.length === 1 ? "common.record_n" : "common.record_n_plural", tenants.length)}
      actions={
        <>
          <Button variant="secondary" onClick={() => downloadCsv(`/api/export/tenants?filename=${encodeURIComponent(tf("export.tenants_filename"))}`, tf("export.tenants_filename"))}>
            <Download className="h-4 w-4" /> {tf("export.button")}
          </Button>
          {tenants.length > 0 && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> {tf("tenants.new")}
            </Button>
          )}
        </>
      }
      width="max-w-6xl"
    >

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={tf("tenants.search")}
            className="ps-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{tf("common.loading")}</Card>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Users className="size-7" />} title={tenants.length === 0 ? tf("tenants.no_tenants") : tf("common.no_matches")} />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tf("tenants.name")}</TableHead>
                  <TableHead>{tf("tenants.active_unit")}</TableHead>
                  <TableHead>{tf("tenants.email")}</TableHead>
                  <TableHead>{tf("tenants.phone")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/tenants/${t.id}`)}>
                    <TableCell className="font-medium">
                      {t.first_name} {t.last_name}
                    </TableCell>
                    <TableCell>
                      {t.active_unit_name ? (
                        <span className="text-sm">
                          {t.active_property_name && <span className="text-muted-foreground">{t.active_property_name} · </span>}
                          {t.active_unit_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.email ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" /> {t.email}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {t.phone ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" /> {t.phone}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

      <TenantDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) load(); }} />
    </PageShell>
  );
}
