import { useEffect, useState } from "react";
import { useApp } from "@/context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { t, tf } from "@/i18n";
import type { Property, PropertyType, NewProperty } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property;
  onSaved?: (p: Property) => void;
}

const TYPES: { value: PropertyType; label: string }[] = [
  { value: "single_family", label: "property_type.single_family" },
  { value: "multi_family", label: "property_type.multi_family" },
  { value: "condo", label: "property_type.condo" },
  { value: "townhouse", label: "property_type.townhouse" },
  { value: "commercial", label: "property_type.commercial" },
];

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

export function PropertyDialog({ open, onOpenChange, property, onSaved }: Props) {
  const app = useApp();
  const appProfile = app.profile;
  // The property-geography fields are profile-owned: the dialog renders an
  // opaque geo slot (if the profile supplies one) and stores its values
  // keyed by geo column name — without knowing what the columns mean.
  const GeoFields = appProfile.geo.component;
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [type, setType] = useState<PropertyType>("single_family");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState(appProfile.defaults.country);
  const [geoValues, setGeoValues] = useState<Record<string, string | null>>({});
  const [yearBuilt, setYearBuilt] = useState("");
  const [color, setColor] = useState("sky");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(property?.name ?? "");
    setType((property?.type as PropertyType) ?? "single_family");
    setAddress(property?.address ?? "");
    setCity(property?.city ?? "");
    setStateName(property?.state ?? "");
    setZip(property?.zip ?? "");
    setCountry(property?.country ?? appProfile.defaults.country);
    const record = property as unknown as Record<string, unknown> | null;
    const initial: Record<string, string | null> = {};
    for (const col of appProfile.geo.columns) {
      const v = record?.[col];
      initial[col] = typeof v === "string" ? v : "";
    }
    setGeoValues(initial);
    setYearBuilt(property?.year_built ? String(property.year_built) : "");
    setColor(property?.color ?? "sky");
    setNotes(property?.notes ?? "");
  }, [open, property, appProfile]);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      // Normalize the profile's geo values uniformly (trim, null when empty) —
      // the same net effect the pre-separation form had per field.
      const geoPayload: Record<string, string | null> = {};
      for (const col of appProfile.geo.columns) {
        const v = geoValues[col];
        geoPayload[col] = typeof v === "string" && v.trim() ? v.trim() : null;
      }
      const payload = {
        name: name.trim(),
        type,
        address: address.trim() || null,
        city: city.trim() || null,
        state: stateName.trim() || null,
        zip: zip.trim() || null,
        country: country.trim() || null,
        year_built: yearBuilt ? parseInt(yearBuilt, 10) : null,
        color,
        notes: notes.trim() || null,
        ...geoPayload,
      };
      const saved = property
        ? await app.updateProperty(property.id, payload as NewProperty)
        : await app.createProperty(payload as NewProperty);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!property) return;
    try {
      await app.deleteProperty(property.id);
      onOpenChange(false);
    } catch (err) {
      app.setError((err as Error).message);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{property ? tf("properties.edit_title") : tf("properties.new_title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="prop-name">{tf("common.name")}</Label>
            <Input id="prop-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={tf("common.placeholder_property_name")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{tf("common.type")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as PropertyType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{tf(t.label)}</SelectItem>)}
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
          <div>
            <Label htmlFor="prop-addr">{tf("common.address")}</Label>
            <Input id="prop-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={tf("common.placeholder_address")} />
          </div>
          {GeoFields ? <GeoFields value={geoValues} onChange={setGeoValues} /> : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prop-city">{tf("common.city")}</Label>
              <Input id="prop-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="prop-country">{tf("geo.country")}</Label>
              <Input id="prop-country" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="prop-state">{tf("common.state")}</Label>
              <Input id="prop-state" value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="—" />
            </div>
            <div>
              <Label htmlFor="prop-zip">{tf("common.zip")}</Label>
              <Input id="prop-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="—" />
            </div>
          </div>
          <div>
            <Label htmlFor="prop-year">{tf("common.year_built")}</Label>
            <Input id="prop-year" type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="prop-notes">{tf("common.notes")}</Label>
            <Textarea id="prop-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="mt-2">
          {property && (
            <Button type="button" variant="destructive" className="sm:me-auto" onClick={() => setConfirming(true)}>
              {tf("common.delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{tf("common.cancel")}</Button>
          <Button type="button" onClick={save} disabled={saving || !name.trim()}>
            {property ? tf("common.save") : tf("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {property ? (
        <ConfirmDelete
          open={confirming}
          onOpenChange={setConfirming}
          title={tf("properties.delete_title")}
          description={tf("properties.delete_desc")}
          onConfirm={remove}
          confirmLabel={tf("common.delete")}
        />
      ) : null}
    </>
  );
}