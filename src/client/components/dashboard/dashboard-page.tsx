import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Home,
  Receipt,
  Wrench,
} from "lucide-react";
import { useApp } from "@/context";
import { api } from "@/api";
import { cn, daysBetween, formatDate, formatMoney, toIsoDate } from "@/lib/utils";
import type { DashboardSummary } from "@/types";
import { Card } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { tf } from "@/i18n";

export function DashboardPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings, setError } = useApp();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api<DashboardSummary>("GET", "/api/dashboard/summary");
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setError]);

  if (loading || !summary) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="p-8 text-center text-sm text-muted-foreground">{tf("dashboard.loading")}</Card>
      </div>
    );
  }

  return (
    <PageShell
      title={tf("dashboard.title")}
      meta={tf("dashboard.meta", new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }))}
    >

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label={tf("dashboard.occupancy")}
            value={`${summary.occupancy_rate}%`}
            sub={tf("common.occupied_of", summary.occupied, summary.units)}
            icon={<Home className="h-4 w-4" />}
          />
          <KpiCard
            label={tf("dashboard.active_leases")}
            value={String(summary.active_leases)}
            sub={summary.upcoming_move_outs ? tf("common.ending_in_30", summary.upcoming_move_outs) : tf("dashboard.no_move_outs")}
            icon={<ClipboardList className="h-4 w-4" />}
          />
          <KpiCard
            label={tf("dashboard.outstanding_rent")}
            value={formatMoney(summary.month_outstanding, settings.currency)}
            sub={tf("common.collected_this_month", formatMoney(summary.month_collected, settings.currency))}
            icon={<Receipt className="h-4 w-4" />}
          />
          <KpiCard
            label={tf("dashboard.open_work_orders")}
            value={String(summary.open_work_orders)}
            sub={summary.urgent_work_orders ? tf("common.urgent_count", summary.urgent_work_orders) : tf("dashboard.nothing_urgent")}
            icon={<Wrench className="h-4 w-4" />}
            tone={summary.urgent_work_orders > 0 ? "warn" : "default"}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tf("dashboard.portfolio")}</h2>
              <button
                type="button"
                onClick={() => navigate("/properties")}
                className="text-xs font-medium text-primary hover:underline"
              >
                {tf("common.view_all")}
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <Row label={tf("dashboard.properties")} value={summary.properties} icon={<Building2 className="h-4 w-4" />} />
              <Row label={tf("dashboard.total_units")} value={summary.units} />
              <Row label={tf("dashboard.occupied")} value={summary.occupied} tone="positive" />
              <Row label={tf("dashboard.vacant")} value={summary.vacant} tone={summary.vacant > 0 ? "warn" : "default"} />
            </dl>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tf("dashboard.months_rent")}</h2>
              <button
                type="button"
                onClick={() => navigate("/rent")}
                className="text-xs font-medium text-primary hover:underline"
              >
                {tf("dashboard.open_ledger")}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat
                label={tf("dashboard.collected")}
                value={formatMoney(summary.month_collected, settings.currency)}
                tone="positive"
              />
              <Stat
                label={tf("dashboard.outstanding")}
                value={formatMoney(summary.month_outstanding, settings.currency)}
                tone={summary.month_outstanding > 0 ? "warn" : "default"}
              />
              <Stat
                label={tf("dashboard.overdue")}
                value={formatMoney(summary.overdue_total, settings.currency)}
                sub={summary.overdue_count ? tf("common.overdue_count", summary.overdue_count) : undefined}
                tone={summary.overdue_total > 0 ? "danger" : "default"}
              />
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tf("dashboard.open_work_orders")}</h2>
              <button
                type="button"
                onClick={() => navigate("/maintenance")}
                className="text-xs font-medium text-primary hover:underline"
              >
                {tf("common.view_all")}
              </button>
            </div>
            {summary.recent_work_orders.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title={tf("dashboard.all_caught_up")} description={tf("dashboard.no_open_wos")} className="py-8" />
            ) : (
              <ul className="divide-y">
                {summary.recent_work_orders.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[w.property_name, w.unit_name].filter(Boolean).join(" · ") || tf("common.unassigned")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PriorityBadge priority={w.priority} />
                      <StatusBadge status={w.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{tf("dashboard.expirations")}</h2>
              <button
                type="button"
                onClick={() => navigate("/leases")}
                className="text-xs font-medium text-primary hover:underline"
              >
                {tf("common.view_all")}
              </button>
            </div>
            {summary.upcoming_expirations.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="size-5" />} title={tf("dashboard.nothing_60")} description={tf("dashboard.no_expirations")} className="py-8" />
            ) : (
              <ul className="divide-y">
                {summary.upcoming_expirations.map((l) => {
                  const today = toIsoDate(new Date());
                  const days = daysBetween(today, l.end_date);
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {l.tenant_first_name || "—"} {l.tenant_last_name || ""}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[l.property_name, l.unit_name].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="text-end text-xs">
                        <div className="font-medium text-foreground">{formatDate(l.end_date)}</div>
                        <div className={cn(
                          "text-muted-foreground",
                          days <= 14 && "text-destructive font-medium",
                        )}>
                          {days < 0 ? tf("common.already_ended") : days === 0 ? tf("common.today") : tf("common.in_days", days)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
    </PageShell>
  );
}

function KpiCard({
  label, value, sub, icon, tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <Card className={cn("relative px-3 py-2.5", tone === "warn" && "bg-warning-tint")}>
      <span
        className={cn(
          "absolute end-3 top-2.5 opacity-50",
          tone === "warn" ? "text-warning" : "text-muted-foreground",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className={cn(
        "data text-[1.375rem] font-semibold leading-tight tracking-[-0.01em]",
        tone === "warn" && "text-warning",
      )}>
        {value}
      </div>
      <div className="section-label mt-0.5">{label}</div>
      {/* Fixed height: toggling the comparison line must never shift the row. */}
      <div className="mt-1 h-4 truncate text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}

function Row({
  label, value, icon, tone = "default",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "default" | "positive" | "warn" | "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={cn(
        "font-medium tabular-nums",
        tone === "positive" && "text-success",
        tone === "warn" && "text-warning",
        tone === "danger" && "text-destructive",
      )}>
        {value}
      </dd>
    </div>
  );
}

function Stat({
  label, value, sub, tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "positive" | "warn" | "danger";
}) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={cn(
        "mt-1 text-xl font-semibold tabular-nums",
        tone === "positive" && "text-success",
        tone === "warn" && "text-warning",
        tone === "danger" && "text-destructive",
      )}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    urgent: "tone-danger",
    high: "tone-warning",
    normal: "tone-info",
    low: "tone-neutral",
  };
  return (
    <span className={cn("badge-tone capitalize", map[priority] ?? "tone-neutral")}>
      {priority === "urgent" && <CircleAlert className="h-3 w-3" />}
      {tf(`priority.${priority}`)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "tone-info",
    assigned: "tone-success",
    in_progress: "tone-warning",
    completed: "tone-neutral",
    cancelled: "tone-neutral",
  };
  return <span className={cn("badge-tone capitalize", map[status] ?? "tone-neutral")}>{tf(`wo_status.${status}`)}</span>;
}
