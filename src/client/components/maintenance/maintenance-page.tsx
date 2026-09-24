import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Plus, Wrench } from "lucide-react";
import { useApp } from "@/context";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkOrderDialog } from "./work-order-dialog";
import type { WorkOrder, WorkOrderStatus } from "@/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { tf } from "@/i18n";

const PRIORITY_TONE: Record<string, string> = {
  urgent: "tone-danger",
  high: "tone-warning",
  normal: "tone-info",
  low: "tone-neutral",
};

const STATUS_TONE: Record<string, string> = {
  open: "tone-info",
  assigned: "tone-success",
  in_progress: "tone-warning",
  completed: "tone-neutral",
  cancelled: "tone-neutral",
};

export function MaintenancePage() {
  const app = useApp();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WorkOrderStatus | "open_all" | "all">("open_all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkOrder | undefined>(undefined);

  async function load() {
    try {
      setLoading(true);
      const list = await app.listWorkOrders();
      setOrders(list);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const counts = useMemo(() => {
    const c = { all: orders.length, open: 0, assigned: 0, in_progress: 0, completed: 0, urgent: 0 };
    for (const o of orders) {
      if (o.status === "open") c.open++;
      if (o.status === "assigned") c.assigned++;
      if (o.status === "in_progress") c.in_progress++;
      if (o.status === "completed") c.completed++;
      if (o.priority === "urgent" && o.status !== "completed" && o.status !== "cancelled") c.urgent++;
    }
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    if (filter === "open_all") return orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  return (
    <PageShell
      title={tf("maintenance.title")}
      meta={<>
          {tf("maintenance.open_count", counts.open + counts.assigned + counts.in_progress)}
          {counts.urgent > 0 && (
            <span className="badge-tone tone-danger ms-2">
              <CircleAlert className="h-3 w-3" /> {tf("common.urgent_count", counts.urgent)}
            </span>
          )}
        </>}
      actions={
        filtered.length > 0 ? (
          <Button onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> {tf("maintenance.new")}
          </Button>
        ) : null
      }
    >

        <Tabs value={filter} onValueChange={(v) => setFilter(v as never)}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="open_all">{tf("maintenance.open")}</TabsTrigger>
            <TabsTrigger value="open">{tf("maintenance.unassigned")}</TabsTrigger>
            <TabsTrigger value="assigned">{tf("maintenance.assigned")}</TabsTrigger>
            <TabsTrigger value="in_progress">{tf("maintenance.in_progress")}</TabsTrigger>
            <TabsTrigger value="completed">{tf("maintenance.completed")}</TabsTrigger>
            <TabsTrigger value="all">{tf("maintenance.all")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{tf("common.loading")}</Card>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Wrench className="size-7" />} title={tf("maintenance.nothing")} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filtered.map((w) => (
              <Card
                key={w.id}
                className="cursor-pointer p-4 transition-colors duration-150 hover:bg-muted"
                onClick={() => { setEditing(w); setDialogOpen(true); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{w.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[w.property_name, w.unit_name].filter(Boolean).join(" · ") || tf("common.unassigned")}
                    </p>
                  </div>
                  <span className={cn("badge-tone capitalize", PRIORITY_TONE[w.priority] ?? "tone-neutral")}>
                    {w.priority === "urgent" && <CircleAlert className="me-1 h-3 w-3" />}
                    {tf(`priority.${w.priority}`)}
                  </span>
                </div>
                {w.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{w.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={cn("badge-tone capitalize", STATUS_TONE[w.status] ?? "tone-neutral")}>{tf(`wo_status.${w.status}`)}</span>
                    {w.vendor_name && <span className="text-muted-foreground">{w.vendor_name}</span>}
                  </div>
                  <div className="text-end text-muted-foreground">
                    {w.scheduled_at && <div>{tf("maintenance.scheduled", formatDate(w.scheduled_at))}</div>}
                    {w.completed_at && <div>{tf("maintenance.completed_on", formatDate(w.completed_at))}</div>}
                    {w.cost != null && <div className="font-medium tabular-nums text-foreground">{formatMoney(w.cost, app.settings.currency)}</div>}
                    {!w.scheduled_at && !w.completed_at && w.cost == null && <div>{tf("maintenance.created", formatDate(w.created_at))}</div>}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

      <WorkOrderDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) load(); }}
        workOrder={editing}
      />
    </PageShell>
  );
}
