import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import type { Application, ApplicationStatus, Unit } from "@/types";
import { tf } from "@/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application?: Application;
  onSaved?: () => void;
}

/** Workflow order: new → screening → approved / declined / withdrawn. */
const STATUSES: ApplicationStatus[] = ["new", "screening", "approved", "declined", "withdrawn"];

/**
 * The server stores any status without a guard (P10 is UI-only), so the dialog
 * enforces the workflow itself: new may only move into screening, screening may
 * only close into a decision, and a decision is terminal.
 */
function allowedFrom(status: ApplicationStatus): ApplicationStatus[] {
  if (status === "new") return ["new", "screening"];
  if (status === "screening") return ["screening", "approved", "declined", "withdrawn"];
  return [status];
}

export function ApplicationDialog({ open, onOpenChange, application, onSaved }: Props) {
  const app = useApp();
  const [units, setUnits] = useState<Unit[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [unitId, setUnitId] = useState<number | "">("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [income, setIncome] = useState("");
  const [employer, setEmployer] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [status, setStatus] = useState<ApplicationStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const all = await app.listUnits();
        setUnits(all);
      } catch (err) {
        app.setError((err as Error).message);
      }
    })();
  }, [open, app]);

  useEffect(() => {
    if (!open) return;
    setUnitId(application?.unit_id ?? "");
    setFirstName(application?.first_name ?? "");
    setLastName(application?.last_name ?? "");
    setEmail(application?.email ?? "");
    setPhone(application?.phone ?? "");
    setIncome(application?.monthly_income != null ? String(application.monthly_income) : "");
    setEmployer(application?.employer ?? "");
    setMoveIn(application?.desired_move_in?.slice(0, 10) ?? "");
    setStatus(application?.status ?? "new");
    setNotes(application?.notes ?? "");
    setPropertyId("");
  }, [open, application]);

  const filteredUnits = useMemo(() => {
    if (!propertyId) return units;
    return units.filter((u) => u.property_id === Number(propertyId));
  }, [units, propertyId]);

  // Keep the property filter on the unit's own property (opens correctly on an
  // existing application, and follows the unit when one is picked).
  useEffect(() => {
    if (!unitId) return;
    const u = units.find((x) => x.id === Number(unitId));
    if (u && propertyId !== u.property_id) setPropertyId(u.property_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, units]);

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const parsedIncome = income ? parseFloat(income) : NaN;
      const payload = {
        unit_id: unitId ? Number(unitId) : null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        monthly_income: Number.isFinite(parsedIncome) ? parsedIncome : null,
        employer: employer.trim() || null,
        desired_move_in: moveIn.slice(0, 10) || null,
        status,
        notes: notes.trim() || null,
      };
      if (application) {
        await app.updateApplication(application.id, payload);
      } else {
        await app.createApplication(payload);
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
    if (!application) return;
    try {
      await app.deleteApplication(application.id);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  const selectable = allowedFrom(status);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{application ? tf("applications.edit_title") : tf("applications.new_title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="app-first">{tf("common.first_name")}</Label>
              <Input id="app-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="app-last">{tf("common.last_name")}</Label>
              <Input id="app-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="app-email">{tf("common.email")}</Label>
              <Input id="app-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="app-phone">{tf("common.phone")}</Label>
              <Input id="app-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{tf("common.property")}</Label>
              <Select value={String(propertyId || "")} onValueChange={(v) => { setPropertyId(v ? Number(v) : ""); setUnitId(""); }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {app.properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tf("applications.unit")}</Label>
              <Select value={String(unitId || "")} onValueChange={(v) => setUnitId(v ? Number(v) : "")}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {filteredUnits.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{tf("common.status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} disabled={!selectable.includes(s)}>
                      {tf(`application_status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="app-movein">{tf("applications.move_in")}</Label>
              <Input id="app-movein" type="date" value={moveIn} onChange={(e) => setMoveIn(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="app-income">{tf("common.monthly_income")}</Label>
              <Input id="app-income" type="number" value={income} onChange={(e) => setIncome(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="app-employer">{tf("common.employer")}</Label>
              <Input id="app-employer" value={employer} onChange={(e) => setEmployer(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="app-notes">{tf("common.notes")}</Label>
            <Textarea id="app-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          {application && (
            <div className="text-xs text-muted-foreground">
              {tf("applications.applied_on", formatDate(application.created_at))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          {application && (
            <Button type="button" variant="destructive" className="sm:me-auto" onClick={() => setConfirming(true)}>
              {tf("common.delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tf("common.cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving || !valid}>
            {application ? tf("common.save") : tf("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {application ? (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={tf("applications.delete_title")}
          description={tf("applications.delete_desc")}
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}
