import { useEffect, useMemo, useState } from "react";
import { FileText, Phone, Plus, Search } from "lucide-react";
import { useApp } from "@/context";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApplicationDialog } from "./application-dialog";
import type { Application, ApplicationStatus } from "@/types";
import { PageShell } from "@/components/page-shell";
import { tf } from "@/i18n";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive" | "info" | "success" | "warning";

const STATUS_VARIANT: Record<ApplicationStatus, BadgeVariant> = {
  new: "info",
  screening: "warning",
  approved: "success",
  declined: "destructive",
  withdrawn: "outline",
};

type Filter = ApplicationStatus | "all";

export function ApplicationsPage() {
  const app = useApp();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Application | undefined>(undefined);

  async function load() {
    try {
      setLoading(true);
      const list = await app.listApplications();
      setApplications(list);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const filtered = useMemo(() => {
    let out = applications;
    if (filter !== "all") out = out.filter((a) => a.status === filter);
    if (q.trim()) {
      const needle = q.toLowerCase();
      out = out.filter((a) =>
        `${a.first_name} ${a.last_name} ${a.email ?? ""} ${a.phone ?? ""} ${a.employer ?? ""} ${a.property_name ?? ""} ${a.unit_name ?? ""}`.toLowerCase().includes(needle),
      );
    }
    return out;
  }, [applications, filter, q]);

  return (
    <PageShell
      title={tf("applications.title")}
      meta={tf(applications.length === 1 ? "common.record_n" : "common.record_n_plural", applications.length)}
      actions={
        applications.length > 0 ? (
          <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> {tf("applications.new")}
          </Button>
        ) : null
      }
      width="max-w-6xl"
    >

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">{tf("applications.all")}</TabsTrigger>
              <TabsTrigger value="new">{tf("application_status.new")}</TabsTrigger>
              <TabsTrigger value="screening">{tf("application_status.screening")}</TabsTrigger>
              <TabsTrigger value="approved">{tf("application_status.approved")}</TabsTrigger>
              <TabsTrigger value="declined">{tf("application_status.declined")}</TabsTrigger>
              <TabsTrigger value="withdrawn">{tf("application_status.withdrawn")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={tf("applications.search")} className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{tf("common.loading")}</Card>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <FileText className="size-7 text-faint" aria-hidden />
            <p className="font-medium">{applications.length === 0 ? tf("applications.nothing") : tf("common.no_matches")}</p>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {applications.length === 0 ? tf("applications.empty_desc") : tf("applications.no_match")}
            </p>
            {applications.length === 0 && (
              <Button className="mt-2" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
                <Plus className="mr-1 h-4 w-4" /> {tf("applications.new")}
              </Button>
            )}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tf("common.name")}</TableHead>
                  <TableHead>{tf("applications.property_unit")}</TableHead>
                  <TableHead>{tf("common.email")}</TableHead>
                  <TableHead>{tf("common.phone")}</TableHead>
                  <TableHead>{tf("applications.move_in")}</TableHead>
                  <TableHead>{tf("common.status")}</TableHead>
                  <TableHead>{tf("applications.applied")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => { setEditing(a); setDialogOpen(true); }}>
                    <TableCell className="font-medium">
                      {a.first_name} {a.last_name}
                    </TableCell>
                    <TableCell>
                      {a.unit_name ? (
                        <span className="text-sm">
                          {a.property_name && <span className="text-muted-foreground">{a.property_name} · </span>}
                          {a.unit_name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.email ? (
                        <span className="text-sm text-muted-foreground">{a.email}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.phone ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" /> {a.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.desired_move_in ? (
                        <span className="text-sm">{formatDate(a.desired_move_in)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"} className="capitalize">
                        {tf(`application_status.${a.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{formatDate(a.created_at)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

      <ApplicationDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) load(); }}
        application={editing}
      />
    </PageShell>
  );
}
