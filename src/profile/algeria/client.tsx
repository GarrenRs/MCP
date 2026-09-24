/**
 * Algeria profile — property-geography form slot.
 *
 * Rendered by the core property dialog inside its generic geo slot. The
 * dialog owns the field values (keyed by geo column name) and normalizes them
 * at save time; this component only edits the profile's wilaya + commune
 * fields. Layout mirrors the pre-separation product: a two-column row below
 * the address, above the city/country row.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t } from "@/i18n";
import type { GeoFieldProps } from "@/profile-types";
import { WILAYAS } from "./wilayas";

export function AlgerianAddressFields({ value, onChange }: GeoFieldProps) {
  const wilaya = value.wilaya ?? "";
  const commune = value.commune ?? "";
  const set = (key: string, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label>{t("geo.wilaya")}</Label>
        <Select value={wilaya} onValueChange={(v) => set("wilaya", v)}>
          <SelectTrigger>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {WILAYAS.map((w) => (
              <SelectItem key={w.code} value={w.name}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="prop-commune">{t("geo.commune")}</Label>
        <Input
          id="prop-commune"
          value={commune}
          onChange={(e) => set("commune", e.target.value)}
        />
      </div>
    </div>
  );
}