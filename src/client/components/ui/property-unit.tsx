import { cn } from "@/lib/utils";

/**
 * Shared "Property · Unit" composite used by the applications, leases and
 * rent tables. Property renders muted, the unit medium, and the whole token
 * is allowed to wrap (`whitespace-normal`) where the table cell would
 * otherwise force it onto one line — a long French property name
 * ("OBS: Résidence El Djazaïr") can then wrap instead of pushing the column
 * past the table's available width.
 */
export function PropertyUnit({
  property,
  unit,
  className,
}: {
  property?: string | null;
  unit?: string | null;
  className?: string;
}) {
  if (!unit) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className={cn("text-sm whitespace-normal", className)}>
      {property && (
        <>
          <span className="text-muted-foreground">{property}</span>
          <span className="px-1 text-muted-foreground/40">·</span>
        </>
      )}
      <span className="font-medium">{unit}</span>
    </span>
  );
}