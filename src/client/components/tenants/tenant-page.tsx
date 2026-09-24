import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Pencil, Phone, User } from "lucide-react";
import { useApp } from "@/context";
import { api } from "@/api";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { TenantDialog } from "./tenant-dialog";
import type { Lease, Tenant } from "@/types";
import { PageShell } from "@/components/page-shell";
import { tf } from "@/i18n";

export function TenantPage({ id, navigate }: { id: number; navigate: (to: string) => void }) {
  const app = useApp();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const [{ tenant: t }, ll] = await Promise.all([
        api<{ tenant: Tenant }>("GET", `/api/tenants/${id}`),
        app.listLeases({ tenant_id: id }),
      ]);
      setTenant(t);
      setLeases(ll);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Card className="p-8 text-center text-sm text-muted-foreground">{tf("tenants.loading")}</Card>
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-sm text-muted-foreground">{tf("tenants.not_found")}</p>
        <Button variant="outline" onClick={() => navigate("/tenants")}>{tf("tenants.back_to")}</Button>
      </div>
    );
  }

  const activeLease = leases.find((l) => l.status === "active");

  return (
    <PageShell
      title={
        <button
          type="button"
          onClick={() => navigate("/tenants")}
          className="inline-flex items-center gap-1.5 text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] transition-colors duration-150 hover:text-muted-foreground"
        >
          <ArrowLeft className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
          {tf("tenants.title")}
        </button>
      }
      width="max-w-5xl"
    >
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.01em]">{tenant.first_name} {tenant.last_name}</h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {tenant.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {tenant.email}</span>}
                {tenant.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {tenant.phone}</span>}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="me-1 h-4 w-4" /> {tf("common.edit")}
          </Button>
        </header>

        {activeLease && (
          <Card className="p-5">
            <div className="text-[1.0625rem] font-semibold leading-tight">{tf("tenants.active_lease")}</div>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-4">
              <Field label={tf("common.property")}>{activeLease.property_name ?? "—"}</Field>
              <Field label={tf("leases.unit")}>{activeLease.unit_name ?? "—"}</Field>
              <Field label={tf("tenants.term")}>
                {formatDate(activeLease.start_date)} → {formatDate(activeLease.end_date)}
              </Field>
              <Field label={tf("tenants.monthly_rent")}>{formatMoney(activeLease.monthly_rent, app.settings.currency)}</Field>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="mb-3 text-[1.0625rem] font-semibold leading-tight">{tf("tenants.about")}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label={tf("tenants.date_of_birth")}>{tenant.date_of_birth ? formatDate(tenant.date_of_birth) : "—"}</Field>
            <Field label={tf("tenants.emergency_contact")}>{tenant.emergency_contact || "—"}</Field>
            <Field label={tf("tenants.employer")}>{tenant.employer || "—"}</Field>
            <Field label={tf("tenants.monthly_income")}>
              {tenant.monthly_income != null ? formatMoney(tenant.monthly_income, app.settings.currency) : "—"}
            </Field>
          </div>
          {tenant.notes && (
            <>
              <div className="mt-4 text-[0.9375rem] font-semibold leading-tight">{tf("common.notes")}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{tenant.notes}</p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-[1.0625rem] font-semibold leading-tight">{tf("tenants.lease_history")}</h2>
          {leases.length === 0 ? (
            <EmptyState title={tf("tenants.no_leases")} className="py-8" />
          ) : (
            <ul className="divide-y">
              {leases.map((l) => (
                <li key={l.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {l.property_name} · {l.unit_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(l.start_date)} → {formatDate(l.end_date)} · {formatMoney(l.monthly_rent, app.settings.currency)}{tf("common.per_month")}
                    </p>
                  </div>
                  <span className={cn("badge-tone capitalize", l.status === "active" ? "tone-success" : "tone-neutral")}>{tf(`lease_status.${l.status}`)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

      <TenantDialog
        open={editing}
        onOpenChange={(o) => { setEditing(o); if (!o) load(); }}
        tenant={tenant}
      />
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-label">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  );
}
