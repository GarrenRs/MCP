import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { TestEnv } from "./helpers/d1";
import { createTestEnv } from "./helpers/d1";
import { call } from "./helpers/api";
import app, { resetSeedForTests } from "../src/server/index";
import {
  BASE_NAME,
  BASE_VERSION,
  runMigrations,
  type Migration,
  type MigrationDriver,
} from "../src/server/migrate";
import { getLocale, isSupportedLocale, setLocale, t, tf } from "../src/client/i18n";
import { formatDate, formatMoney } from "../src/client/lib/utils";
import { WILAYAS } from "../src/client/lib/wilayas";
import en from "../src/client/i18n/en.json";
import fr from "../src/client/i18n/fr.json";

let env: TestEnv;

beforeEach(() => {
  env = createTestEnv();
  resetSeedForTests();
  setLocale("en");
});

/** Read the additive geography migration straight from disk. */
const GEO_MIGRATION: Migration = {
  version: "0002_property_geography",
  name: "0002_property_geography.sql",
  sql: readFileSync(resolve(process.cwd(), "migrations/0002_property_geography.sql"), "utf8"),
};

function schemaBase(): Migration {
  return { version: BASE_VERSION, name: BASE_NAME, sql: readFileSync(resolve(process.cwd(), "src/server/schema.sql"), "utf8") };
}

function driverFor(stub: TestEnv["DB"]): MigrationDriver {
  return {
    async exec(sql: string): Promise<void> {
      stub.exec(sql);
    },
    async query<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
      return stub.prepare(sql).all<T>().results;
    },
  };
}

/** Flatten a nested catalog object into dotted keys. */
function flattenKeys(cat: unknown, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(cat as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") out.push(...flattenKeys(v, key));
    else out.push(key);
  }
  return out;
}

describe("localization catalog (P4)", () => {
  it("supports fr-DZ as a first-class locale", () => {
    expect(isSupportedLocale("fr-DZ")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
  });

  it("activates the French catalog", () => {
    expect(setLocale("fr-DZ")).toBe("fr-DZ");
    expect(getLocale()).toBe("fr-DZ");
    expect(t("nav.dashboard")).toBe("Tableau de bord");
    expect(t("common.save")).toBe("Enregistrer");
    expect(t("rent.title")).toBe("Registre des loyers");
  });

  it("keeps English as the fallback for unknown locales", () => {
    expect(setLocale("fr")).toBe("en");
    expect(t("nav.dashboard")).toBe("Dashboard");
  });

  it("paces the English catalog key-for-key in French", () => {
    const frMissing = flattenKeys(en).filter((key) => !flattenKeys(fr).includes(key));
    expect(frMissing).toEqual([]);
    // Round trip: every key resolves to a real string in both languages.
    for (const key of flattenKeys(en)) {
      expect(typeof t(key, "en")).toBe("string");
      expect(t(key, "en").length).toBeGreaterThan(0);
      expect(typeof t(key, "fr-DZ")).toBe("string");
      expect(t(key, "fr-DZ").length).toBeGreaterThan(0);
    }
  });

  it("substitutes positional tokens via tf", () => {
    setLocale("fr-DZ");
    expect(tf("leases.meta", 3, 1)).toBe("3 au total · 1 en cours");
    setLocale("en");
    expect(tf("leases.meta", 3, 1)).toBe("3 total · 1 active");
  });
});

describe("DZD + French formatting (P4)", () => {
  it("renders whole dinars with the DA suffix", () => {
    const frSpaced = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");
    const out = frSpaced(formatMoney(1500, "DZD", "fr-DZ"));
    expect(out).toContain("DA");
    expect(out).toContain("1 500 DA");
    expect(out).not.toContain(".");
  });

  it("renders ISO dates as dd/MM/yyyy for French locales", () => {
    expect(formatDate("2026-04-01", "fr-DZ")).toBe("01/04/2026");
    expect(formatDate("2026-12-31", "fr-DZ")).toBe("31/12/2026");
  });

  it("keeps the month-short style for English and honors overrides", () => {
    expect(formatDate("2026-04-01", "en")).toContain("Apr");
    expect(formatDate("2026-04-01", "fr-DZ", { day: "numeric", month: "long", year: "numeric" })).toContain("avril");
  });
});

describe("migration 0002 (P4)", () => {
  it("is additive and records its version", async () => {
    const stub = createTestEnv().DB;
    const applied = await runMigrations(driverFor(stub), [schemaBase(), GEO_MIGRATION]);
    expect(applied.applied).toEqual(["0001", "0002_property_geography"]);

    const cols = stub
      .prepare("PRAGMA table_info(properties)")
      .all<{ name: string }>()
      .results.map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["country", "wilaya", "commune"]));
  });

  it("re-running 0002 is a no-op", async () => {
    const stub = createTestEnv().DB;
    const driver = driverFor(stub);
    await runMigrations(driver, [schemaBase(), GEO_MIGRATION]);
    const second = await runMigrations(driver, [schemaBase(), GEO_MIGRATION]);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["0001", "0002_property_geography"]);
  });

  it("converges fresh and pre-existing databases", async () => {
    const fresh = createTestEnv().DB;
    await runMigrations(driverFor(fresh), [schemaBase(), GEO_MIGRATION]);
    const existing = createTestEnv().DB;
    await runMigrations(driverFor(existing), [schemaBase(), GEO_MIGRATION]);
    const versions = (stub: TestEnv["DB"]): string[] =>
      stub.prepare("SELECT version FROM schema_migrations ORDER BY version").all<{ version: string }>().results.map((r) => r.version);
    expect(versions(existing)).toEqual(versions(fresh));
    expect(versions(fresh)).toEqual([BASE_VERSION, "0002_property_geography"]);
  });
});

describe("property geography CRUD (P4)", () => {
  beforeEach(async () => {
    await runMigrations(driverFor(env.DB), [schemaBase(), GEO_MIGRATION]);
  });

  it("persists country, wilaya, and commune", async () => {
    const created = await call<{ property: Record<string, unknown> }>(env, "POST", "/api/properties", {
      name: "Résidence des Oliviers",
      type: "multi_family",
      address: "12 Rue Didouche Mourad",
      city: "Alger",
      country: "DZ",
      wilaya: "Alger",
      commune: "Sidi M'Hamed",
    });
    expect(created.status).toBe(201);
    expect(created.body.property.country).toBe("DZ");
    expect(created.body.property.wilaya).toBe("Alger");
    expect(created.body.property.commune).toBe("Sidi M'Hamed");

    const id = (created.body.property as { id: number }).id;
    const listed = await call<{ properties: Array<Record<string, unknown>> }>(env, "GET", "/api/properties");
    const match = listed.body.properties.find((p) => p.id === id);
    expect(match?.wilaya).toBe("Alger");
    expect(match?.commune).toBe("Sidi M'Hamed");
  });

  it("updates geography fields additively", async () => {
    const created = await call<{ property: Record<string, unknown> }>(env, "POST", "/api/properties", {
      name: "Villa des Pins",
      country: "DZ",
      wilaya: "Oran",
    });
    const id = (created.body.property as { id: number }).id;

    const put = await call<{ property: Record<string, unknown> }>(env, "PUT", `/api/properties/${id}`, {
      commune: "Bir El Djir",
    });
    expect(put.body.property.commune).toBe("Bir El Djir");
    expect(put.body.property.wilaya).toBe("Oran");
  });

  it("keeps legacy rows without geo fields valid (NULL, no crash)", async () => {
    const created = await call<{ property: Record<string, unknown> }>(env, "POST", "/api/properties", {
      name: "Ancien Dossier",
    });
    expect(created.status).toBe(201);
    expect(created.body.property.country).toBeNull();
    expect(created.body.property.wilaya).toBeNull();
    expect(created.body.property.commune).toBeNull();

    // The demo seed rows also read back cleanly after the migration.
    const listed = await call<{ properties: Array<Record<string, unknown>> }>(env, "GET", "/api/properties");
    const demo = listed.body.properties.find((p) => p.name === "Oakwood Estate");
    expect(demo?.wilaya).toBeNull();
  });
});

describe("settings reflect the Algerian defaults (P4)", () => {
  it("serves fr-DZ and DZD on a cold database", async () => {
    const res = await call<{ settings: Record<string, string> }>(env, "GET", "/api/settings");
    expect(res.body.settings.locale).toBe("fr-DZ");
    expect(res.body.settings.currency).toBe("DZD");
  });

  it("round-trips fr-DZ + DZD through the API", async () => {
    const put = await call<{ settings: Record<string, string> }>(env, "PUT", "/api/settings", {
      locale: "fr-DZ",
      currency: "DZD",
    });
    expect(put.body.settings.locale).toBe("fr-DZ");
    expect(put.body.settings.currency).toBe("DZD");
  });
});

describe("wilaya dataset sanity (P4)", () => {
  it("lists all 58 wilayas with unique codes and non-empty names", () => {
    expect(WILAYAS.length).toBe(58);
    const codes = WILAYAS.map((w) => w.code);
    expect(new Set(codes).size).toBe(58);
    for (const w of WILAYAS) {
      expect(w.name.trim().length).toBeGreaterThan(0);
      expect(w.code).toMatch(/^\d{2}$/);
    }
  });

  it("contains key Algerian wilayas", () => {
    const names = WILAYAS.map((w) => w.name);
    expect(names).toContain("Alger");
    expect(names).toContain("Oran");
    expect(names).toContain("Constantine");
    expect(names).toContain("Tamanrasset");
  });
});