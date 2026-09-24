import { beforeEach, describe, expect, it } from "vitest";
import {
  getLocale,
  isSupportedLocale,
  registerCatalogs,
  registerLocales,
  resolveErrorMessage,
  setLocale,
  t,
} from "../src/client/i18n";
import { formatDate, formatMoney } from "../src/client/lib/utils";

/**
 * Core-only evidence for the Core + Algeria Profile separation.
 *
 * Nothing in this file imports or registers a profile, so these assertions
 * prove the bare core is market-neutral: English base catalog only, no
 * currency/locale defaults, no brand/geo/option keys, no RTL assumption, and
 * a money formatter that never assumes a currency.
 */
describe("core i18n stays market-neutral without a profile", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("defaults to English and supports no profile locales", () => {
    expect(getLocale()).toBe("en");
    expect(isSupportedLocale("fr-DZ")).toBe(false);
    expect(isSupportedLocale("ar")).toBe(false);
  });

  it("falls back to English for arbitrary input", () => {
    expect(setLocale("fr-DZ")).toBe("en");
    expect(t("nav.dashboard")).toBe("Dashboard");
  });

  it("does not resolve profile-owned keys in the bare core", () => {
    expect(t("app.brand")).toBe("app.brand");
    expect(t("geo.wilaya")).toBe("geo.wilaya");
    expect(t("geo.commune")).toBe("geo.commune");
    expect(t("vendors.option_fr_dz")).toBe("vendors.option_fr_dz");
  });

  it("formats money without assuming a currency", () => {
    expect(formatMoney(1234)).toBe("1,234");
    expect(formatMoney(1234, "DZD", "en")).toContain("1,234");
  });

  it("formats dates by explicit locale", () => {
    expect(formatDate("2026-04-01", "en")).toContain("Apr");
  });

  it("maps error codes through the bare English catalog", () => {
    expect(resolveErrorMessage("not_found", "Not found")).toBe("Not found");
  });

  it("registration is additive and idempotent", () => {
    registerLocales(["x-y"]);
    registerCatalogs({ "x-y": { demo: { key: "value" } } });
    expect(isSupportedLocale("x-y")).toBe(true);
    expect(t("demo.key", "x-y")).toBe("value");
    // Re-registering the same profile must not corrupt or duplicate.
    registerLocales(["x-y"]);
    registerCatalogs({ "x-y": { demo: { key: "value" } } });
    expect(t("demo.key", "x-y")).toBe("value");
    // Unknown keys in the registered catalog fall through to English.
    expect(t("nav.dashboard", "x-y")).toBe("Dashboard");
  });
});