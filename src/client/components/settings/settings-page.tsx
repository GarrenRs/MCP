import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { useApp } from "@/context";
import { cn, colorClasses } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Vendor, VendorCategory } from "@/types";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { t, tf } from "@/i18n";
import { UsersTab } from "./users-tab";
import { AuditTab } from "./audit-tab";

const COLORS = ["sky", "emerald", "amber", "rose", "violet", "fuchsia", "teal", "orange", "slate"];

const SWATCH_BG: Record<string, string> = {
  sky: "bg-cat-sky-solid",
  emerald: "bg-cat-emerald-solid",
  amber: "bg-cat-amber-solid",
  rose: "bg-cat-rose-solid",
  violet: "bg-cat-violet-solid",
  fuchsia: "bg-cat-fuchsia-solid",
  teal: "bg-cat-teal-solid",
  orange: "bg-cat-orange-solid",
  slate: "bg-cat-slate-solid",
};

const VENDOR_CATEGORIES: VendorCategory[] = ["plumber", "electrician", "hvac", "handyman", "cleaning", "landscaping", "general"];

export function SettingsPage({ currentUserRole }: { currentUserRole?: string }) {
  return (
    <PageShell
      title={tf("settings.title")}
      width="max-w-5xl"
    >

        <Tabs defaultValue="vendors">
          <TabsList>
            <TabsTrigger value="vendors">{tf("vendors.tab_vendors")}</TabsTrigger>
            <TabsTrigger value="policy">{tf("vendors.tab_policy")}</TabsTrigger>
            {(currentUserRole === "owner" || currentUserRole === "admin") && (
              <TabsTrigger value="users">{t("auth.users")}</TabsTrigger>
            )}
            {(currentUserRole === "owner" || currentUserRole === "admin") && (
              <TabsTrigger value="audit">{t("audit.tab")}</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="vendors" className="mt-4">
            <VendorsTab />
          </TabsContent>
          <TabsContent value="policy" className="mt-4">
            <PolicyTab />
          </TabsContent>
          <TabsContent value="users" className="mt-4">
            <UsersTab currentUserRole={currentUserRole ?? "manager"} />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditTab />
          </TabsContent>
        </Tabs>
    </PageShell>
  );
}

// ── Vendors ────────────────────────────────────────────────────────

function VendorsTab() {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | undefined>(undefined);

  return (
    <Card>
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-sm font-semibold">{tf("vendors.tab_vendors")}</h2>
          <p className="text-xs text-muted-foreground">{tf("vendors.desc")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }}>
          <Plus className="me-1 h-4 w-4" /> {tf("vendors.add")}
        </Button>
      </div>
      {app.vendors.length === 0 ? (
        <EmptyState icon={<Wrench className="size-8" />} title={tf("vendors.no_vendors")} />
      ) : (
        <ul className="divide-y">
          {app.vendors.map((v) => {
            const palette = colorClasses(v.color);
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className={cn("h-2.5 w-2.5 rounded-full", palette.dot)} />
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[v.phone, v.email].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-tone tone-neutral capitalize">{tf(`vendor_category.${v.category}`)}</span>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(v); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <VendorDialog open={open} onOpenChange={setOpen} vendor={editing} />
    </Card>
  );
}

function VendorDialog({
  open, onOpenChange, vendor,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  vendor?: Vendor;
}) {
  const app = useApp();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("general");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState("slate");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(vendor?.name ?? "");
    setCategory(vendor?.category ?? "general");
    setPhone(vendor?.phone ?? "");
    setEmail(vendor?.email ?? "");
    setColor(vendor?.color ?? "slate");
    setNotes(vendor?.notes ?? "");
  }, [open, vendor]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        phone: phone.trim() || null,
        email: email.trim() || null,
        color,
        notes: notes.trim() || null,
      };
      if (vendor) await app.updateVendor(vendor.id, payload);
      else await app.createVendor(payload);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!vendor) return;
    try {
      await app.deleteVendor(vendor.id);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{vendor ? tf("vendors.edit_title") : tf("vendors.new_title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="v-name">{tf("common.name")}</Label>
            <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{tf("common.category")}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as VendorCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{tf(`vendor_category.${c}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tf("common.color")}</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <span className={cn("h-3 w-3 rounded-full", SWATCH_BG[c])} />
                        <span>{t(`color.${c}`)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="v-phone">{tf("common.phone")}</Label>
              <Input id="v-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="v-email">{tf("common.email")}</Label>
              <Input id="v-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="v-notes">{tf("common.notes")}</Label>
            <Textarea id="v-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          {vendor && (
            <Button type="button" variant="destructive" className="sm:me-auto" onClick={() => setConfirming(true)}>
              <Trash2 className="me-1 h-4 w-4" /> {tf("common.delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tf("common.cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving || !name.trim()}>
            {vendor ? tf("common.save") : tf("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {vendor ? (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={tf("vendors.delete_title")}
          description={tf("vendors.delete_desc")}
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}

// ── Policy ─────────────────────────────────────────────────────────

function PolicyTab() {
  const app = useApp();
  const [dueDay, setDueDay] = useState(String(app.settings.default_rent_due_day));
  const [lateFee, setLateFee] = useState(String(app.settings.late_fee_amount));
  const [grace, setGrace] = useState(String(app.settings.late_fee_grace_days));
  const [currency, setCurrency] = useState(app.settings.currency);
  const [locale, setLocale] = useState(app.settings.locale);
  const [saving, setSaving] = useState(false);

  // Locale picker = English (the core base) plus the profile's registered
  // locales, in that order; label keys derive from the locale id (option_<id>).
  const localeOptions = ["en", ...app.profile.locales.ids];
  const localeOptionKey = (id: string) => `vendors.option_${id.replace(/-/g, "_")}`;

  useEffect(() => {
    setDueDay(String(app.settings.default_rent_due_day));
    setLateFee(String(app.settings.late_fee_amount));
    setGrace(String(app.settings.late_fee_grace_days));
    setCurrency(app.settings.currency);
    setLocale(app.settings.locale);
  }, [app.settings]);

  async function save() {
    setSaving(true);
    try {
      await app.updateSettings({
        default_rent_due_day: Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)),
        late_fee_amount: parseFloat(lateFee) || 0,
        late_fee_grace_days: Math.max(0, parseInt(grace, 10) || 0),
        currency: currency.trim().toUpperCase() || app.profile.defaults.settings.currency,
        locale,
      });
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-sm font-semibold">{tf("vendors.policy_title")}</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {tf("vendors.policy_desc")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <Label htmlFor="s-day">{tf("vendors.due_day")}</Label>
          <Input id="s-day" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-late">{tf("vendors.late_fee")}</Label>
          <Input id="s-late" type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-grace">{tf("vendors.grace_days")}</Label>
          <Input id="s-grace" type="number" min={0} value={grace} onChange={(e) => setGrace(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s-cur">{tf("vendors.currency")}</Label>
          <Input id="s-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder={app.profile.defaults.settings.currency} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <Label htmlFor="s-locale">{t("settings.locale")}</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="s-locale"><SelectValue /></SelectTrigger>
            <SelectContent>
              {localeOptions.map((id) => (
                <SelectItem key={id} value={id}>{tf(localeOptionKey(id))}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4">
        <Button onClick={save} disabled={saving}>{tf("vendors.save")}</Button>
      </div>
    </Card>
  );
}
