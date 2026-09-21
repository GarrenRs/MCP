import { useEffect, useState } from "react";
import { useApp } from "@/context";
import { api } from "@/api";
import { formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ChargeStatus, RentCharge } from "@/types";
import { t, tf } from "@/i18n";

const STATUSES: ChargeStatus[] = ["open", "partial", "paid", "overdue", "waived"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: RentCharge | null;
  onSaved?: () => void;
}

export function ChargeEditDialog({ open, onOpenChange, charge, onSaved }: Props) {
  const app = useApp();
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<ChargeStatus>("open");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [waivedConfirm, setWaivedConfirm] = useState(false);
  const [paidWarning, setPaidWarning] = useState(false);

  useEffect(() => {
    if (!open || !charge) return;
    setAmount(String(charge.amount ?? 0));
    setDueDate(charge.due_date ?? "");
    setStatus(charge.status);
    setNotes(charge.notes ?? "");
    setWaivedConfirm(false);
    setPaidWarning(false);
  }, [open, charge]);

  function handleStatusChange(newStatus: string) {
    const s = newStatus as ChargeStatus;
    if (s === "waived" && status !== "waived") {
      setWaivedConfirm(true);
      return;
    }
    if (s !== "paid" && charge?.status === "paid" && (charge.amount_paid ?? 0) > 0) {
      setPaidWarning(true);
      return;
    }
    setStatus(s);
  }

  function confirmWaived() {
    setStatus("waived");
    setWaivedConfirm(false);
  }

  function confirmPaidToOther() {
    setPaidWarning(false);
    setStatus("paid");
  }

  async function save() {
    if (!charge) return;
    const a = parseFloat(amount);
    if (!Number.isFinite(a) || a < 0) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      if (a !== charge.amount) patch.amount = a;
      if (dueDate !== charge.due_date) patch.due_date = dueDate;
      if (status !== charge.status) patch.status = status;
      if ((notes || null) !== (charge.notes || null)) patch.notes = notes.trim() || null;
      if (Object.keys(patch).length > 0) {
        await api("PUT", `/api/rent-charges/${charge.id}`, patch);
      }
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!charge) return null;
  const isPaidCharge = charge.status === "paid" && (charge.amount_paid ?? 0) > 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tf("charge_edit.title")}</DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <div className="font-medium">
            {charge.property_name} · {charge.unit_name}
          </div>
          <div className="text-xs text-muted-foreground">
            {charge.tenant_first_name} {charge.tenant_last_name} · {tf("payments.due", formatDate(charge.due_date))} · {tf("payments.charged", formatMoney(charge.amount, app.settings.currency))}
          </div>
          <div className="mt-1 text-xs">
            {tf("payments.paid_so_far")} <span className="font-medium tabular-nums">{formatMoney(charge.amount_paid, app.settings.currency)}</span>
          </div>
        </div>

        {isPaidCharge && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
            {tf("charge_edit.paid_warning")}
          </div>
        )}

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ce-amount">{tf("charge_edit.amount")}</Label>
              <Input id="ce-amount" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ce-due">{tf("charge_edit.due_date")}</Label>
              <Input id="ce-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{tf("charge_edit.status")}</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{tf(`charge_status.${s}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === "waived" && (
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              {tf("charge_edit.waived_note")}
            </div>
          )}
          <div>
            <Label htmlFor="ce-notes">{tf("common.notes")}</Label>
            <Textarea id="ce-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tf("common.cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving}>{tf("common.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {waivedConfirm && (
      <Dialog open onOpenChange={(o) => { if (!o) setWaivedConfirm(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tf("charge_edit.waived_confirm_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{tf("charge_edit.waived_confirm_desc")}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaivedConfirm(false)}>{tf("common.cancel")}</Button>
            <Button variant="destructive" onClick={confirmWaived}>{tf("charge_edit.waived_confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    {paidWarning && (
      <Dialog open onOpenChange={(o) => { if (!o) setPaidWarning(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tf("charge_edit.paid_change_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{tf("charge_edit.paid_change_desc")}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaidWarning(false)}>{tf("common.cancel")}</Button>
            <Button onClick={confirmPaidToOther}>{tf("charge_edit.paid_change_confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
