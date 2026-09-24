import { beforeEach, describe, expect, it } from "vitest";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import app, { resetSeedForTests } from "../src/server/index";
import { getLocale, registerCatalogs, registerLocales, resolveErrorMessage, setLocale, t } from "../src/client/i18n";
import { formatMoney, formatPeriod } from "../src/client/lib/utils";
import { catalogs as algeriaCatalogs, localeIds as algeriaLocaleIds } from "../src/profile/algeria/locales";

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  // The product registers the Algeria profile's locales before the UI mounts;
  // register them here too so ar/fr-DZ behave exactly like the composed product.
  registerLocales(algeriaLocaleIds);
  registerCatalogs(algeriaCatalogs);
  resetSeedForTests();
});

describe("settings (P3)", () => {
  it("defaults locale to fr-DZ and currency to DZD", async () => {
    const res = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.settings.locale).toBe("fr-DZ");
    expect(res.body.settings.currency).toBe("DZD");
  });

  it("reads and writes locale", async () => {
    const put = await call<{ settings: Record<string, string> }>(env, "PUT", "/api/settings", { locale: "ar" });
    expect(put.status).toBe(200);
    expect(put.body.settings.locale).toBe("ar");
    const get = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(get.body.settings.locale).toBe("ar");
  });

  it("reads and writes currency", async () => {
    const put = await call<{ settings: Record<string, string> }>(env, "PUT", "/api/settings", { currency: "DZD" });
    expect(put.status).toBe(200);
    expect(put.body.settings.currency).toBe("DZD");
    const get = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(get.body.settings.currency).toBe("DZD");
  });

  it("merges settings additively and keeps existing values intact", async () => {
    await call(env, "PUT", "/api/settings", { late_fee_amount: "75" });
    const put = await call<{ settings: Record<string, string> }>(env, "PUT", "/api/settings", { locale: "ar" });
    expect(put.body.settings).toMatchObject({
      default_rent_due_day: "1",
      late_fee_amount: "75",
      late_fee_grace_days: "5",
      currency: "DZD",
      locale: "ar",
    });
    const get = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(get.body.settings).toMatchObject({ late_fee_amount: "75", locale: "ar" });
  });
});

describe("server error codes (P3)", () => {
  it("exposes a stable code for invalid id", async () => {
    const res = await call(env, "GET", "/api/properties/not-a-number");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "invalid_id", error: "Invalid ID" });
  });

  it("exposes a stable code for not found", async () => {
    const res = await call(env, "GET", "/api/properties/999999");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "not_found", error: "Not found" });
  });

  it("exposes a stable code for validation failures", async () => {
    const res = await call<{ code?: string; error?: string }>(env, "POST", "/api/properties", {});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error!.length).toBeGreaterThan(0);
  });

  it("exposes a stable code for no fields on partial update", async () => {
    const res = await call(env, "PUT", "/api/properties/1", {});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "no_fields", error: "No fields" });
  });

  it("exposes a stable code for malformed JSON bodies", async () => {
    const res = await app.request("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{oops",
    }, env);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_json", error: "Invalid JSON" });
  });

  it("exposes a stable code for non-object bodies", async () => {
    const res = await call(env, "PUT", "/api/settings", "just-a-string");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "invalid_body", error: "Body must be an object" });
  });

  it("exposes a stable code when a period is required", async () => {
    const res = await call(env, "POST", "/api/rent-charges/generate", {});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "period_required", error: "period (YYYY-MM) required" });
  });

  it("keeps the legacy {error} shape on every error", async () => {
    const paths = [
      { method: "GET", route: "/api/properties/x" },
      { method: "GET", route: "/api/properties/999999" },
      { method: "POST", route: "/api/properties", body: {} },
    ];
    for (const p of paths) {
      const res = await call<{ error?: string; code?: string }>(env, p.method, p.route, (p as { body?: unknown }).body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(typeof res.body.error).toBe("string");
      expect(typeof res.body.code).toBe("string");
    }
  });
});

describe("client error-code mapping (P3)", () => {
  it("maps known codes to their localized message", async () => {
    setLocale("en");
    expect(resolveErrorMessage("invalid_id", "Invalid ID")).toBe("Invalid ID");
    expect(resolveErrorMessage("period_required", "period (YYYY-MM) required")).toBe("A period (YYYY-MM) is required");
    expect(resolveErrorMessage("not_found", "Not found")).toBe("Not found");
  });

  it("returns the server message for unknown codes", async () => {
    expect(resolveErrorMessage("totally_unknown", "Some server message")).toBe("Some server message");
    expect(resolveErrorMessage(undefined, "Legacy message")).toBe("Legacy message");
  });

  it("localizes messages in the active locale", async () => {
    setLocale("ar");
    expect(resolveErrorMessage("not_found", "Not found")).toBe("غير موجود");
    setLocale("en");
    expect(resolveErrorMessage("not_found", "Not found")).toBe("Not found");
  });

  it("falls back to English for unsupported locales", async () => {
    setLocale("fr");
    expect(getLocale()).toBe("en");
  });

  it("falls back to English catalog for missing keys", async () => {
    expect(t("settings.locale", "ar")).toBe("اللغة");
    expect(t("settings.locale", "fr")).toBe("Language");
  });
});

describe("crash-proof formatting (P3)", () => {
  it("never throws on malformed currency codes", () => {
    // A real browser throws RangeError for these; we must not.
    const bad = ["EURO", "X!", "USD:USD", "12", "", "USD", null, undefined];
    for (const currency of bad) {
      expect(() => formatMoney(1234, currency as string)).not.toThrow();
    }
    expect(formatMoney(1234, "X!").length).toBeGreaterThan(0);
  });

  it("formats money with a supported currency", () => {
    expect(formatMoney(1200, "USD", "en")).toContain("1,200");
    expect(formatMoney(1200, "DZD", "en")).toContain("1,200");
  });

  it("renders a dash for missing amounts", () => {
    expect(formatMoney(null, "USD")).toBe("—");
    expect(formatMoney(undefined, "USD")).toBe("—");
  });

  it("formats a period with an explicit locale", () => {
    expect(formatPeriod("2026-04", "en")).toContain("April");
    expect(formatPeriod("2026-04", "ar")).toContain("أبريل");
  });
});