import { beforeEach, describe, expect, it } from "vitest";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import { resetSeedForTests } from "../src/server/index";
import { applyDemoFixture } from "./helpers/demo-fixture";

let env: TestEnv;

beforeEach(async () => {
  env = createTestEnv();
  resetSeedForTests();
  await applyDemoFixture(env);
});

async function createLease(overrides: Record<string, unknown> = {}) {
  const tenant = await call<{ tenant: { id: number } }>(env, "POST", "/api/tenants", {
    first_name: "Ada", last_name: "Lovelace",
  });
  const unit = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
  const lease = await call<{ lease: { id: number } }>(env, "POST", "/api/leases", {
    unit_id: unit.body.units[0].id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2027-12-31",
    monthly_rent: 1200,
    rent_due_day: 1,
    status: "active",
    ...overrides,
  });
  return lease.body.lease;
}

async function generateCharge(period: string) {
  await call(env, "POST", "/api/rent-charges/generate", { period });
  const res = await call<{ charges: Array<{ id: number; amount: number; amount_paid: number; status: string; due_date: string; notes: string | null }> }>(env, "GET", "/api/rent-charges?period=" + period);
  return res.body.charges[0];
}

async function getCharge(id: number) {
  const res = await call<{ charges: Array<{ id: number; amount: number; amount_paid: number; status: string; due_date: string; notes: string | null }> }>(env, "GET", "/api/rent-charges");
  return res.body.charges.find((c) => c.id === id)!;
}

async function recordPayment(chargeId: number, amount: number) {
  return call(env, "POST", "/api/payments", {
    charge_id: chargeId,
    amount,
    paid_at: "2026-12-15",
    method: "cash",
  });
}

const FUTURE_PERIOD = "2027-06";

describe("charge edit (integration)", () => {
  it("updates amount and recomputes status", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);
    expect(charge.amount).toBe(1200);
    expect(charge.status).toBe("open");

    const res = await call<{ charge: { amount: number; status: string } }>(env, "PUT", "/api/rent-charges/" + charge.id, { amount: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.charge.amount).toBe(1500);
    expect(res.body.charge.status).toBe("open");
  });

  it("updates due_date", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    const res = await call<{ charge: { due_date: string } }>(env, "PUT", "/api/rent-charges/" + charge.id, { due_date: "2027-06-15" });
    expect(res.status).toBe(200);
    expect(res.body.charge.due_date).toBe("2027-06-15");
  });

  it("updates notes", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    const res = await call<{ charge: { notes: string } }>(env, "PUT", "/api/rent-charges/" + charge.id, { notes: "Test note" });
    expect(res.status).toBe(200);
    expect(res.body.charge.notes).toBe("Test note");
  });

  it("sets status to waived", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    const res = await call<{ charge: { status: string } }>(env, "PUT", "/api/rent-charges/" + charge.id, { status: "waived" });
    expect(res.status).toBe(200);
    expect(res.body.charge.status).toBe("waived");
  });

  it("waived charge stays waived (excluded from overdue)", async () => {
    await createLease({ start_date: "2025-01-01" });
    const charge = await generateCharge("2025-05");
    expect(charge.status).toBe("overdue");

    await call(env, "PUT", "/api/rent-charges/" + charge.id, { status: "waived" });

    const after = await getCharge(charge.id);
    expect(after.status).toBe("waived");
  });

  it("recomputes status after partial payment then amount change", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    await recordPayment(charge.id, 600);
    const afterPay = await getCharge(charge.id);
    expect(afterPay.amount_paid).toBe(600);
    expect(afterPay.status).toBe("partial");

    const res = await call<{ charge: { amount: number; status: string; amount_paid: number } }>(env, "PUT", "/api/rent-charges/" + charge.id, { amount: 600 });
    expect(res.status).toBe(200);
    expect(res.body.charge.amount).toBe(600);
    expect(res.body.charge.amount_paid).toBe(600);
    expect(res.body.charge.status).toBe("paid");
  });

  it("preserves payment history after amount change", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    await recordPayment(charge.id, 500);
    await recordPayment(charge.id, 300);

    await call(env, "PUT", "/api/rent-charges/" + charge.id, { amount: 2000 });

    const payments = await call<{ payments: Array<{ id: number; amount: number }> }>(env, "GET", "/api/rent-charges/" + charge.id + "/payments");
    expect(payments.body.payments).toHaveLength(2);

    const chargeAfter = await getCharge(charge.id);
    expect(chargeAfter.amount_paid).toBe(800);
  });

  it("returns 404 for nonexistent charge", async () => {
    const res = await call(env, "PUT", "/api/rent-charges/99999", { amount: 100 });
    expect(res.status).toBe(404);
  });

  it("returns 400 for no fields", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);
    const res = await call(env, "PUT", "/api/rent-charges/" + charge.id, {});
    expect(res.status).toBe(400);
  });

  it("paid charges remain consistent after notes edit", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    await recordPayment(charge.id, 1200);
    const paid = await getCharge(charge.id);
    expect(paid.status).toBe("paid");
    expect(paid.amount_paid).toBe(1200);

    const res = await call<{ charge: { notes: string; status: string; amount_paid: number } }>(env, "PUT", "/api/rent-charges/" + charge.id, { notes: "fully paid" });
    expect(res.status).toBe(200);
    expect(res.body.charge.notes).toBe("fully paid");
    expect(res.body.charge.status).toBe("paid");
    expect(res.body.charge.amount_paid).toBe(1200);
  });

  it("amount_paid remains derived from payments after amount increase", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);

    await recordPayment(charge.id, 400);

    const res = await call<{ charge: { amount: number; amount_paid: number; status: string } }>(env, "PUT", "/api/rent-charges/" + charge.id, { amount: 2000 });
    expect(res.body.charge.amount).toBe(2000);
    expect(res.body.charge.amount_paid).toBe(400);
    expect(res.body.charge.status).toBe("partial");
  });
});

describe("charge edit authorization (integration)", () => {
  it("charge edit succeeds without auth when AUTH_ENABLED is false", async () => {
    await createLease();
    const charge = await generateCharge(FUTURE_PERIOD);
    const res = await call(env, "PUT", "/api/rent-charges/" + charge.id, { notes: "no auth needed" });
    expect(res.status).toBe(200);
  });
});
