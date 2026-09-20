import { describe, expect, it } from "vitest";
import {
  clampDueDay,
  computeChargeStatus,
  computeDueDate,
  currentUtcDate,
  formatDueDay,
  isChargeOverdue,
  planChargeGeneration,
} from "../src/server/finance";

describe("clampDueDay", () => {
  it("keeps valid days unchanged", () => {
    expect(clampDueDay(1)).toBe(1);
    expect(clampDueDay(15)).toBe(15);
    expect(clampDueDay(28)).toBe(28);
  });

  it("clamps days above 28 to 28", () => {
    expect(clampDueDay(29)).toBe(28);
    expect(clampDueDay(30)).toBe(28);
    expect(clampDueDay(31)).toBe(28);
  });

  it("clamps days below 1 to 1", () => {
    expect(clampDueDay(0)).toBe(1);
    expect(clampDueDay(-3)).toBe(1);
  });
});

describe("formatDueDay", () => {
  it("zero-pads single digit days", () => {
    expect(formatDueDay(1)).toBe("01");
    expect(formatDueDay(5)).toBe("05");
  });

  it("keeps two digit days intact", () => {
    expect(formatDueDay(10)).toBe("10");
    expect(formatDueDay(28)).toBe("28");
  });
});

describe("computeDueDate", () => {
  it("builds a YYYY-MM-DD due date", () => {
    expect(computeDueDate("2026-09", 5)).toBe("2026-09-05");
  });

  it("clamps a day over 28 within the due date", () => {
    expect(computeDueDate("2026-09", 31)).toBe("2026-09-28");
  });
});

describe("planChargeGeneration", () => {
  const lease = (id: number, over: Partial<{ monthly_rent: number; rent_due_day: number; end_date: string }> = {}) => ({
    id,
    monthly_rent: over.monthly_rent ?? 1200,
    rent_due_day: over.rent_due_day ?? 1,
    end_date: over.end_date ?? "2027-12-31",
  });

  it("plans a charge for every active lease that covers the period", () => {
    const plans = planChargeGeneration([lease(1), lease(2)], "2026-09");
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => p.lease_id)).toEqual([1, 2]);
    expect(plans[0]).toEqual({ lease_id: 1, period: "2026-09", due_date: "2026-09-01", amount: 1200 });
  });

  it("skips leases that end before the period starts", () => {
    const plans = planChargeGeneration([lease(1), lease(2, { end_date: "2026-08-31" })], "2026-09");
    expect(plans).toHaveLength(1);
    expect(plans[0].lease_id).toBe(1);
  });

  it("clamps the due day to 28", () => {
    const plans = planChargeGeneration([lease(1, { rent_due_day: 31 })], "2026-09");
    expect(plans[0].due_date).toBe("2026-09-28");
  });

  it("uses the lease's monthly rent as the charge amount", () => {
    const plans = planChargeGeneration([lease(1, { monthly_rent: 1750 })], "2026-09");
    expect(plans[0].amount).toBe(1750);
  });

  it("returns an empty plan when no lease covers the period", () => {
    expect(planChargeGeneration([], "2026-09")).toEqual([]);
  });
});

describe("computeChargeStatus", () => {
  it("returns open with no payments", () => {
    expect(computeChargeStatus(900, 0)).toBe("open");
  });

  it("returns partial with a payment below the amount", () => {
    expect(computeChargeStatus(900, 400)).toBe("partial");
  });

  it("returns paid at a matching payment", () => {
    expect(computeChargeStatus(900, 900)).toBe("paid");
  });

  it("returns paid for overpayment", () => {
    expect(computeChargeStatus(900, 1000)).toBe("paid");
  });
});

describe("isChargeOverdue", () => {
  const charge = (over: Partial<{ amount: number; amount_paid: number; due_date: string; status: string }> = {}) => ({
    amount: over.amount ?? 900,
    amount_paid: over.amount_paid ?? 0,
    due_date: over.due_date ?? "2026-08-31",
    status: over.status ?? "open",
  });
  const TODAY = "2026-09-20";

  it("is overdue when open, past due, and unpaid", () => {
    expect(isChargeOverdue(charge(), TODAY)).toBe(true);
  });

  it("is overdue when partial, past due, and partly paid", () => {
    expect(isChargeOverdue(charge({ amount_paid: 400, status: "partial" }), TODAY)).toBe(true);
  });

  it("is not overdue when due today or later", () => {
    expect(isChargeOverdue(charge({ due_date: TODAY }), TODAY)).toBe(false);
    expect(isChargeOverdue(charge({ due_date: "2026-10-01" }), TODAY)).toBe(false);
  });

  it("is not overdue when fully paid", () => {
    expect(isChargeOverdue(charge({ amount: 900, amount_paid: 900 }), TODAY)).toBe(false);
  });

  it("is not overdue when the balance is paid in full", () => {
    expect(isChargeOverdue(charge({ amount_paid: 900, status: "paid" }), TODAY)).toBe(false);
  });

  it("is not overdue when the status is paid", () => {
    expect(isChargeOverdue(charge({ status: "paid", amount_paid: 900 }), TODAY)).toBe(false);
  });

  it("is not overdue when the status is waived", () => {
    expect(isChargeOverdue(charge({ status: "waived" }), TODAY)).toBe(false);
  });

  it("is not overdue when the status is already overdue", () => {
    expect(isChargeOverdue(charge({ status: "overdue" }), TODAY)).toBe(false);
  });

  it("is not overdue when the amount due is already covered", () => {
    expect(isChargeOverdue(charge({ amount: 900, amount_paid: 950 }), TODAY)).toBe(false);
  });
});

describe("currentUtcDate", () => {
  it("returns a YYYY-MM-DD UTC date string", () => {
    expect(currentUtcDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches new Date().toISOString().slice(0, 10)", () => {
    expect(currentUtcDate()).toBe(new Date().toISOString().slice(0, 10));
  });
});