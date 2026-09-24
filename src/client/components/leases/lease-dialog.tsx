import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context";
import { api } from "@/api";
import { toIsoDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { tf } from "@/i18n";
import type { Lease, LeaseStatus, Tenant, Unit } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease?: Lease;
  defaults?: { unit_id?: number; primary_tenant_id?: number };
  onSaved?: () => void;
}

const STATUSES: LeaseStatus[] = ["upcoming", "active", "ended", "cancelled"];

export function LeaseDialog({ open, onOpenChange, lease, defaults, onSaved }: Props) {
  const app = useApp();
  const [units, setUnits] = useState<Unit[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [unitId, setUnitId] = useState<number | "">("");
  const [tenantId, setTenantId] = useState<number | "">("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rent, setRent] = useState("0");
  const [deposit, setDeposit] = useState("0");
  const [dueDay, setDueDay] = useState("1");
  const [lateFee, setLateFee] = useState("0");
  const [status, setStatus] = useState<LeaseStatus>("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [u, t] = await Promise.all([app.listUnits(), app.listTenants()]);
        setUnits(u);
        setTenants(t);
      } catch (err) {
        app.setError((err as Error).message);
      }
    })();
  }, [open, app]);

  useEffect(() => {
    if (!open) return;
    setUnitId(lease?.unit_id ?? defaults?.unit_id ?? "");
    setTenantId(lease?.primary_tenant_id ?? defaults?.primary_tenant_id ?? "");
    const today = toIsoDate(new Date());
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    setStart(lease?.start_date ?? today);
    setEnd(lease?.end_date ?? toIsoDate(oneYear));
    setRent(String(lease?.monthly_rent ?? 0));
    setDeposit(String(lease?.deposit ?? 0));
    setDueDay(String(lease?.rent_due_day ?? app.settings.default_rent_due_day));
    setLateFee(String(lease?.late_fee ?? app.settings.late_fee_amount));
    setStatus(lease?.status ?? "active");
    setNotes(lease?.notes ?? "");
  }, [open, lease, defaults, app.settings]);

  // When picking a unit we don't already have rent for, pre-fill from market_rent.
  const selectedUnit = useMemo(() => units.find((u) => u.id === unitId), [units, unitId]);
  useEffect(() => {
    if (!lease && selectedUnit && parseFloat(rent) === 0) {
      setRent(String(selectedUnit.market_rent ?? 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUnit?.id]);

  async function save() {
    if (!unitId || !start || !end) return;
    setSaving(true);
    try {
      const payload = {
        unit_id: Number(unitId),
        primary_tenant_id: tenantId ? Number(tenantId) : null,
        start_date: start,
        end_date: end,
        monthly_rent: parseFloat(rent) || 0,
        deposit: parseFloat(deposit) || 0,
        rent_due_day: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)),
        late_fee: parseFloat(lateFee) || 0,
        status,
        notes: notes.trim() || null,
      };
      if (lease) {
        await app.updateLease(lease.id, payload);
      } else {
        // Auto-create tenant fallback would go here, but we require selecting an existing tenant.
        await app.createLease(payload);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!lease) return;
    try {
      await app.deleteLease(lease.id);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  // Get a property association from the API (LEASE_SELECT joins) — but for the dialog
  // we just need property + unit name in the dropdown. Build a "Property · Unit" label.
  // Fetch once when open.
  const [unitLabels, setUnitLabels] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await api<{ units: Unit[] }>("GET", "/api/units");
        const map = new Map<number, string>();
        for (const u of data.units) {
          map.set(u.id, `${u.property_name ?? "—"} · ${u.name}`);
        }
        setUnitLabels(map);
      } catch {
        /* ignore */
      }
    })();
  }, [open]);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lease ? tf("leases.edit_title") : tf("leases.new_title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{tf("leases.unit")}</Label>
              <Select value={String(unitId || "")} onValueChange={(v) => setUnitId(v ? Number(v) : "")}>
                <SelectTrigger><SelectValue placeholder={tf("leases.pick_unit")} /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {unitLabels.get(u.id) ?? `${u.property_name ?? "—"} · ${u.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tf("leases.primary_tenant")}</Label>
              <Select value={String(tenantId || "")} onValueChange={(v) => setTenantId(v ? Number(v) : "")}>
                <SelectTrigger><SelectValue placeholder={tf("leases.pick_tenant")} /></SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.first_name} {t.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="l-start">{tf("leases.start")}</Label>
              <Input id="l-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="l-end">{tf("leases.end")}</Label>
              <Input id="l-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="l-rent">{tf("leases.monthly_rent")}</Label>
              <Input id="l-rent" type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="l-dep">{tf("leases.security_deposit")}</Label>
              <Input id="l-dep" type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="l-day">{tf("common.rent_due_day")}</Label>
              <Input id="l-day" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="l-late">{tf("common.late_fee")}</Label>
              <Input id="l-late" type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
            </div>
            <div>
              <Label>{tf("common.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeaseStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{tf(`lease_status.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="l-notes">{tf("common.notes")}</Label>
            <Textarea id="l-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="mt-2">
          {lease && (
            <Button type="button" variant="destructive" className="sm:me-auto" onClick={() => setConfirming(true)}>
              {tf("common.delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tf("common.cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving || !unitId || !start || !end}>
            {lease ? tf("common.save") : tf("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <ConfirmDelete
        open={confirming}
        onOpenChange={setConfirming}
        title={tf("leases.delete_title")}
        description={tf("leases.delete_desc")}
        onConfirm={remove}
      />
    </>
  );
}
