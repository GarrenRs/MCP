// Pure financial/business rules extracted from src/server/index.ts so they are
// unit-testable without a database. Call sites in the app must keep using these
// functions verbatim so the rules stay single-sourced.

export type ChargeStatus = "open" | "partial" | "paid" | "overdue" | "waived";

export interface ChargeGenerationSource {
  id: number;
  monthly_rent: number;
  rent_due_day: number;
  end_date: string;
}

export interface ChargePlan {
  lease_id: number;
  period: string;
  due_date: string;
  amount: number;
}

export interface ChargeOverdueState {
  amount: number;
  amount_paid: number;
  due_date: string;
  status: string;
}

/** Clamp a lease rent-due day into the enforceable 1..28 window (SQLite-compatible). */
export function clampDueDay(day: number): number {
  return Math.min(28, Math.max(1, day));
}

/** Zero-padded day string (`5` → `"05"`), clamped to 1..28. */
export function formatDueDay(day: number): string {
  return String(clampDueDay(day)).padStart(2, "0");
}

/** `YYYY-MM` period + due day → `YYYY-MM-DD` due date (clamped to ≤ 28). */
export function computeDueDate(period: string, dueDay: number): string {
  return `${period}-${formatDueDay(dueDay)}`;
}

/**
 * Plan the charges to create for one period across active leases.
 * Idempotence itself is enforced by the `ON CONFLICT(lease_id, period)` database
 * guard; this function computes *what* would be created (skip leases that ended
 * before the period, clamped due date, amount = monthly rent).
 */
export function planChargeGeneration(
  leases: ChargeGenerationSource[],
  period: string,
): ChargePlan[] {
  const periodStart = `${period}-01`;
  const plans: ChargePlan[] = [];
  for (const l of leases) {
    if (l.end_date < periodStart) continue;
    plans.push({
      lease_id: l.id,
      period,
      due_date: computeDueDate(period, l.rent_due_day),
      amount: l.monthly_rent,
    });
  }
  return plans;
}

/** Payment reconciliation: derive a charge status from amount vs amount_paid. */
export function computeChargeStatus(
  amount: number,
  amountPaid: number,
): "paid" | "partial" | "open" {
  return amountPaid >= amount ? "paid" : amountPaid > 0 ? "partial" : "open";
}

/**
 * Overdue rule: a charge is overdue when it is still open/partial, its due date
 * is before `today` (YYYY-MM-DD), and it holds an outstanding balance.
 * Waived and paid charges are never overdue.
 */
export function isChargeOverdue(state: ChargeOverdueState, today: string): boolean {
  if (state.status !== "open" && state.status !== "partial") return false;
  if (state.amount_paid >= state.amount) return false;
  return state.due_date < today;
}

/** UTC `YYYY-MM-DD` for "today", matching SQLite `date('now')`. */
export function currentUtcDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}