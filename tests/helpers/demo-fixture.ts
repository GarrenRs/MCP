import type { TestEnv } from "./d1";

/**
 * Dev/QA demo fixture — the "Austin" sample portfolio that the pre-separation
 * runtime seeded automatically on first run.
 *
 * Per the Core + Algeria Profile separation gate, demo data is NOT part of the
 * commercial runtime: the server (src/server/app.ts) never seeds it. Tests
 * that exercise list / dashboard / lease flows opt in explicitly by applying
 * this fixture in their beforeEach — same rows, same order, same readable
 * names as the old runtime seed, so existing assertions stay valid contract
 * evidence.
 */
const DEMO_PROPERTIES: Array<[string, string, string, string, string, string, string]> = [
  ["Oakwood Estate", "single_family", "210 Oakwood Ln", "Austin", "TX", "78704", "emerald"],
  ["Honeybee Hideaway", "single_family", "88 Bramble Ct", "Austin", "TX", "78704", "amber"],
  ["308 Mission Apartments", "multi_family", "308 Mission St", "Austin", "TX", "78702", "sky"],
];

/** property index (into DEMO_PROPERTIES), name, beds, baths, sqft, rent, status */
const DEMO_UNITS: Array<[number, string, number, number, number, number, string]> = [
  [0, "Main house", 3, 2, 1450, 2300, "occupied"],
  [1, "Main house", 2, 1, 980, 1700, "occupied"],
  [2, "Unit 1", 1, 1, 620, 1450, "occupied"],
  [2, "Unit 2", 1, 1, 620, 1450, "vacant"],
  [2, "Unit 3", 2, 1, 850, 1850, "occupied"],
];

const DEMO_VENDORS: Array<[string, string, string, string]> = [
  ["Emerald Pool Service", "general", "512-555-0144", "emerald"],
  ["Hill Country Plumbing", "plumber", "512-555-0188", "sky"],
  ["Bright Spark Electric", "electrician", "512-555-0102", "amber"],
];

/** Insert the demo portfolio directly into a fresh test database. */
export async function applyDemoFixture(env: TestEnv): Promise<void> {
  const ids: number[] = [];
  for (const p of DEMO_PROPERTIES) {
    const info = env.DB.prepare(
      "INSERT INTO properties (name, type, address, city, state, zip, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(...p).run();
    ids.push(info.meta.last_row_id);
  }
  for (const [pi, name, beds, baths, sqft, rent, status] of DEMO_UNITS) {
    if (!ids[pi]) continue;
    env.DB.prepare(
      "INSERT INTO units (property_id, name, bedrooms, bathrooms, sqft, market_rent, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(ids[pi], name, beds, baths, sqft, rent, status).run();
  }
  for (const v of DEMO_VENDORS) {
    env.DB.prepare("INSERT INTO vendors (name, category, phone, color) VALUES (?, ?, ?, ?)").bind(...v).run();
  }
}