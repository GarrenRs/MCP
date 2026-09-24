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

interface LeaseRecord {
  id: number;
  unit_id: number;
}

async function createLease(overrides: Record<string, unknown> = {}): Promise<LeaseRecord> {
  const tenant = await call<{ tenant: { id: number } }>(env, "POST", "/api/tenants", {
    first_name: "Grace",
    last_name: "Hopper",
  });
  const unit = await call<{ units: Array<{ id: number }> }>(env, "GET", "/api/units");
  const lease = await call<{ lease: LeaseRecord }>(env, "POST", "/api/leases", {
    unit_id: unit.body.units[0].id,
    primary_tenant_id: tenant.body.tenant.id,
    start_date: "2026-01-01",
    end_date: "2099-12-31",
    monthly_rent: 900,
    rent_due_day: 1,
    status: "active",
    ...overrides,
  });
  return lease.body.lease;
}

interface ChargeRecord {
  id: number;
  amount: number;
  amount_paid: number;
  status: string;
}

async function generateCharge(period: string): Promise<ChargeRecord> {
  const lease = await createLease();
  const gen = await call(env, "POST", "/api/rent-charges/generate", { period });
  expect(gen.status).toBe(200);
  expect(gen.body.created).toBe(1);
  const charges = await call<{ charges: ChargeRecord[] }>(env, "GET", `/api/rent-charges?period=${period}`);
  const charge = charges.body.charges.find((c) => c.id === lease.id && c.amount === 900) ?? charges.body.charges.find((c) => c.amount === 900);
  return charge!;
}

describe("payment recording and charge reconciliation (integration)", () => {
  it("recomputes status when a payment is recorded", async () => {
    const charge = await generateCharge("2099-05");
    const pay = await call<{ charge: ChargeRecord }>(env, "POST", "/api/payments", {
      charge_id: charge.id,
      amount: 400,
    });
    expect(pay.status).toBe(201);
    expect(Number(pay.body.charge.amount_paid)).toBe(400);
    expect(pay.body.charge.status).toBe("partial");
  });

  it("marks the charge paid once payments cover the amount", async () => {
    const charge = await generateCharge("2099-06");
    await call(env, "POST", "/api/payments", { charge_id: charge.id, amount: 400 });
    const paid = await call<{ charge: ChargeRecord }>(env, "POST", "/api/payments", { charge_id: charge.id, amount: 500 });
    expect(paid.body.charge.status).toBe("paid");
    expect(Number(paid.body.charge.amount_paid)).toBe(900);
  });

  it("handles overpayment without going beyond paid", async () => {
    const charge = await generateCharge("2099-07");
    const paid = await call<{ charge: ChargeRecord }>(env, "POST", "/api/payments", {
      charge_id: charge.id,
      amount: 1000,
    });
    expect(paid.body.charge.status).toBe("paid");
    expect(Number(paid.body.charge.amount_paid)).toBe(1000);
  });

  it("recomputes status when a payment is deleted", async () => {
    const charge = await generateCharge("2099-08");
    await call(env, "POST", "/api/payments", { charge_id: charge.id, amount: 400 });
    await call(env, "POST", "/api/payments", { charge_id: charge.id, amount: 500 }); // 900 -> paid
    const list = await call<{ payments: Array<{ id: number; amount: number }> }>(
      env,
      "GET",
      `/api/rent-charges/${charge.id}/payments`,
    );
    expect(list.body.payments).toHaveLength(2);

    // Delete the 400 payment -> back to partial (500 of 900).
    const payment400 = list.body.payments.find((p) => Number(p.amount) === 400)!;
    const del = await call(env, "DELETE", `/api/payments/${payment400.id}`);
    expect(del.status).toBe(200);

    const res = await call<{ charges: ChargeRecord[] }>(env, "GET", "/api/rent-charges?period=2099-08");
    const updated = res.body.charges.find((c) => c.id === charge.id)!;
    expect(Number(updated.amount_paid)).toBe(500);
    expect(updated.status).toBe("partial");
  });

  it("reverts to open when the last payment is deleted", async () => {
    const charge = await generateCharge("2099-09");
    await call(env, "POST", "/api/payments", { charge_id: charge.id, amount: 900 });
    const list = await call<{ payments: Array<{ id: number }> }>(
      env,
      "GET",
      `/api/rent-charges/${charge.id}/payments`,
    );
    const del = await call(env, "DELETE", `/api/payments/${list.body.payments[0].id}`);
    expect(del.status).toBe(200);

    const res = await call<{ charges: ChargeRecord[] }>(env, "GET", "/api/rent-charges?period=2099-09");
    const updated = res.body.charges.find((c) => c.id === charge.id)!;
    expect(Number(updated.amount_paid)).toBe(0);
    expect(updated.status).toBe("open");
  });
});