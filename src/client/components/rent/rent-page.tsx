import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Sparkles, Wallet } from "lucide-react";
import { useApp } from "@/context";
import { addMonths, cn, currentPeriod, formatDate, formatMoney, formatPeriod } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaymentDialog } from "./payment-dialog";
import { ChargeEditDialog } from "./charge-edit-dialog";
import type { ChargeStatus, RentCharge } from "@/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { tf } from "@/i18n";
import { downloadCsv } from "@/api";

const STATUS_TONE: Record<ChargeStatus, string> = {
  open: "tone-info",
  partial: "tone-warning",
  paid: "tone-success",
  overdue: "tone-danger",
  waived: "tone-neutral",
};

export function RentPage() {
  const app = useApp();
  const [period, setPeriod] = useState<string>(currentPeriod());
  const [charges, setCharges] = useState<RentCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentTarget, setPaymentTarget] = useState<RentCharge | null>(null);
  const [editTarget, setEditTarget] = useState<RentCharge | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const list = await app.listCharges(period);
      setCharges(list);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await app.generateCharges(period);
      await load();
      app.setError(res.created ? null : tf("rent.already_generated"));
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const totals = useMemo(() => {
    const charged = charges.reduce((s, c) => s + (c.amount ?? 0), 0);
    const collected = charges.reduce((s, c) => s + (c.amount_paid ?? 0), 0);
    const outstanding = Math.max(0, charged - collected);
    const overdue = charges
      .filter((c) => c.status === "overdue" || (c.status !== "paid" && c.status !== "waived" && c.due_date < new Date().toISOString().slice(0, 10) && c.amount_paid < c.amount))
      .reduce((s, c) => s + ((c.amount ?? 0) - (c.amount_paid ?? 0)), 0);
    return { charged, collected, outstanding, overdue };
  }, [charges]);

  return (
    <PageShell
      title={tf("rent.title")}
      meta={tf("rent.meta")}
      actions={
        <>
          {/* The period stepper is view state, so it sits left of the one ink
              action and names its current value rather than saying "Period". */}
          <div className="inline-flex items-center rounded-full bg-muted p-[0.1875rem]">
            <Button variant="ghost" size="icon" onClick={() => setPeriod((p) => addMonths(p, -1))} aria-label={tf("rent.prev_month")}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <button
              type="button"
              onClick={() => setPeriod(currentPeriod())}
              className={cn(
                "rounded-sm px-3 py-1 text-sm font-medium transition-colors duration-150",
                period === currentPeriod()
                  ? "bg-card text-foreground shadow-raised"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {formatPeriod(period)}
            </button>
            <Button variant="ghost" size="icon" onClick={() => setPeriod((p) => addMonths(p, 1))} aria-label={tf("rent.next_month")}>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
          <Button variant="secondary" onClick={() => downloadCsv(`/api/export/rent-ledger?period=${encodeURIComponent(period)}&filename=${encodeURIComponent(tf("export.rent_filename", period))}`, tf("export.rent_filename", period))}>
            <Download className="h-4 w-4" /> {tf("export.button")}
          </Button>
          {charges.length > 0 && (
            <Button onClick={generate} disabled={generating}>
              <Sparkles className="h-4 w-4" /> {tf("rent.generate")}
            </Button>
          )}
        </>
      }
    >
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label={tf("rent.charged")} value={formatMoney(totals.charged, app.settings.currency)} />
          <Stat label={tf("rent.collected")} value={formatMoney(totals.collected, app.settings.currency)} tone="positive" />
          <Stat
            label={tf("rent.outstanding")}
            value={formatMoney(totals.outstanding, app.settings.currency)}
            tone={totals.outstanding > 0 ? "warn" : "default"}
          />
          <Stat
            label={tf("rent.overdue")}
            value={formatMoney(totals.overdue, app.settings.currency)}
            tone={totals.overdue > 0 ? "danger" : "default"}
          />
        </section>

        {loading ? (
          <Card className="divide-y divide-border overflow-hidden" role="status" aria-label={tf("rent.loading")}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-11 items-center gap-4 px-3" aria-hidden>
                <div className="h-2.5 w-32 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted" />
                <div className="ms-auto h-2.5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </Card>
        ) : charges.length === 0 ? (
          <EmptyState icon={<Wallet className="size-7" />} title={tf("rent.no_charges", formatPeriod(period))} description={tf("rent.no_charges_desc")} />
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tf("rent.property_unit")}</TableHead>
                  <TableHead>{tf("rent.tenant")}</TableHead>
                  <TableHead>{tf("rent.due")}</TableHead>
                  <TableHead className="text-end">{tf("rent.charged")}</TableHead>
                  <TableHead className="text-end">{tf("rent.paid")}</TableHead>
                  <TableHead className="text-end">{tf("rent.balance")}</TableHead>
                  <TableHead>{tf("rent.status")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((c) => {
                  const balance = Math.max(0, (c.amount ?? 0) - (c.amount_paid ?? 0));
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{c.property_name}</span>
                          <span className="px-1 text-muted-foreground/40">·</span>
                          <span className="font-medium">{c.unit_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.tenant_first_name ? (
                          <span className="text-sm">{c.tenant_first_name} {c.tenant_last_name}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(c.due_date)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(c.amount, app.settings.currency)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(c.amount_paid, app.settings.currency)}</TableCell>
                      <TableCell className={cn("text-end tabular-nums font-medium", balance > 0 && "text-warning", c.status === "overdue" && "text-destructive")}>
                        {formatMoney(balance, app.settings.currency)}
                      </TableCell>
                      <TableCell>
                        <span className={cn("badge-tone capitalize", STATUS_TONE[c.status] ?? "tone-neutral")}>
                          {tf(`charge_status.${c.status}`)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTarget(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {c.status !== "paid" && c.status !== "waived" && (
                            <Button size="sm" variant="outline" onClick={() => setPaymentTarget(c)}>
                              {tf("rent.record_payment")}
                            </Button>
                          )}
                          {(c.status === "paid" || c.amount_paid > 0) && (
                            <Button size="sm" variant="ghost" onClick={() => setPaymentTarget(c)}>
                              {tf("rent.view")}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

      <PaymentDialog
        open={paymentTarget !== null}
        onOpenChange={(o) => { if (!o) setPaymentTarget(null); }}
        charge={paymentTarget}
        onSaved={load}
      />
      <ChargeEditDialog
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTarget(null); }}
        charge={editTarget}
        onSaved={load}
      />
    </PageShell>
  );
}

function Stat({
  label, value, tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "warn" | "danger";
}) {
  return (
    <Card className="p-4">
      <div className="stat-label">{label}</div>
      <div className={cn(
        "mt-1 text-xl font-semibold tabular-nums",
        tone === "positive" && "text-success",
        tone === "warn" && "text-warning",
        tone === "danger" && "text-destructive",
      )}>
        {value}
      </div>
    </Card>
  );
}
