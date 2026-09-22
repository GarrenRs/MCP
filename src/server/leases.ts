// Pure lease/occupancy business rules extracted from src/server/index.ts so
// they are unit-testable without a database. Route handlers must call these
// verbatim so the conflict and occupancy rules stay single-sourced.

/**
 * Do two `YYYY-MM-DD` ranges overlap, inclusive of both end points?
 * Lexicographic comparison is correct for ISO dates.
 */
export function dateRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Does this lease status claim the unit (blocks a conflicting lease)? */
export function leaseClaimsUnit(status: string): boolean {
  return status === "active" || status === "upcoming";
}

/**
 * Compute the unit status the lease truth requires, respecting manual
 * `turnover`/`unavailable` overrides. Idempotent: returns the current value
 * when nothing about the lease truth changed.
 *
 * - Any `active` lease  → `occupied`.
 * - An `upcoming` lease alone keeps a manual status if set, otherwise `vacant`
 *   (unit isn't rented out yet).
 * - `turnover`/`unavailable` are manual states and are never clobbered by
 *   reconciliation.
 */
export function reconcileUnitStatus(current: string, activeLeaseCount: number): string {
  if (current === "turnover" || current === "unavailable") return current;
  if (activeLeaseCount > 0) return "occupied";
  return "vacant";
}
