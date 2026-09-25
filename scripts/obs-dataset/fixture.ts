// Disposable Commercial Observation Dataset (OBS) — fixture data.
// Approved design: Docs/execution/governance/disposable-commercial-observation-dataset-design-2026-09-24.md
// Pure data + date helpers, no I/O. Anchor T = load time (UTC), M0 = T's month.
// Every value is deterministic given T; ids are assigned at load time (journaled).

export interface PropertySpec {
  handle: string; name: string; type: string; address: string; city: string;
  state: string | null; zip: string; year_built: number; notes: string; color: string;
  country: string; wilaya: string; commune: string;
}
export interface UnitSpec {
  handle: string; prop: string; name: string; bedrooms: number; bathrooms: number;
  sqft: number; market_rent: number; status: "vacant" | "occupied" | "turnover" | "unavailable";
  notes: string;
}
export interface TenantSpec {
  handle: string; first_name: string; last_name: string; email: string; phone: string;
  employer: string; monthly_income: number; notes: string;
}
export interface LeaseSpec {
  handle: string; unit: string; tenant: string | null; start: string; end: string;
  monthly_rent: number; deposit: number; rent_due_day: number; late_fee: number;
  status: "upcoming" | "active" | "ended" | "cancelled"; notes: string;
}
export interface ChargeSpec {
  handle: string; lease: string; period: string; due_date: string; amount: number;
  amount_paid: number; status: "open" | "partial" | "paid" | "overdue" | "waived"; notes: string;
}
export interface PaymentSpec {
  handle: string; charge: string; paid_at: string; amount: number;
  method: "cash" | "check" | "ach" | "credit" | "other"; reference: string; notes: string;
}
export interface VendorSpec {
  handle: string; name: string; category: string; phone: string; email: string; notes: string; color: string;
}
export interface WorkOrderSpec {
  handle: string; prop: string | null; unit: string | null; tenant: string | null; vendor: string | null;
  title: string; description: string; priority: string; status: string;
  scheduled_at: string | null; completed_at: string | null; cost: number | null; notes: string;
}
export interface ApplicationSpec {
  handle: string; unit: string | null; first_name: string; last_name: string; email: string;
  phone: string; monthly_income: number; employer: string; desired_move_in: string; status: string; notes: string;
}
export interface UserSpec {
  handle: string; email: string; display_name: string; role: "owner" | "admin" | "manager"; password: string;
}
export interface AuditSpec {
  handle: string; actor: string | null; action: string; entity: string; record: string | null;
  old_value: unknown; new_value: unknown; created_at: string;
}

export interface ObsFixture {
  anchor: string; m0: string;
  properties: PropertySpec[]; units: UnitSpec[]; tenants: TenantSpec[]; leases: LeaseSpec[];
  charges: ChargeSpec[]; payments: PaymentSpec[]; vendors: VendorSpec[]; workOrders: WorkOrderSpec[];
  applications: ApplicationSpec[]; users: UserSpec[]; audit: AuditSpec[];
}

// ── Date helpers (UTC) ────────────────────────────────────────────

export function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function shiftPeriod(iso: string, months: number): string {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
function pad(n: number): string { return String(n).padStart(2, "0"); }
function dueDateFor(period: string, dueDay: number): string {
  const d = Math.min(28, Math.max(1, dueDay));
  return `${period}-${pad(d)}`;
}
export function clampDueDay(day: number): number { return Math.min(28, Math.max(1, day)); }

// ── Fixture builder ───────────────────────────────────────────────

export function buildFixture(T: string): ObsFixture {
  const m0 = T.slice(0, 7);
  const m1 = shiftPeriod(T, -1);
  const m2 = shiftPeriod(T, -2);
  const m3 = shiftPeriod(T, -3);
  const m4 = shiftPeriod(T, -4);
  const d = (n: number): string => addDaysISO(T, n);

  const OBS = "OBS:";

  // Users — 4 roles (scenario N). PBKDF2 hashed at load time.
  const users: UserSpec[] = [
    { handle: "u-owner", email: "obs.owner@example.com", display_name: "Dalia Merabet", role: "owner", password: "Obs!Commercial2026" },
    { handle: "u-admin", email: "obs.admin@example.com", display_name: "Yacine Haddad", role: "admin", password: "Obs!Commercial2026" },
    { handle: "u-fin", email: "obs.finance@example.com", display_name: "Nadia Cherif", role: "manager", password: "Obs!Commercial2026" },
    { handle: "u-maint", email: "obs.maintenance@example.com", display_name: "Sofiane Belkacem", role: "manager", password: "Obs!Commercial2026" },
  ];

  // Properties — 8 (scenarios A, B, I, L cover properties; P combines).
  const properties: PropertySpec[] = [
    { handle: "p1", name: `${OBS} Résidence El Djazaïr`, type: "multi_family", address: "5 Rue des Frères, El Madania", city: "Alger", state: null, zip: "16000", year_built: 1978, notes: "OBS:A healthy occupied", color: "sky", country: "DZ", wilaya: "Alger", commune: "El Madania" },
    { handle: "p2", name: `${OBS} Villa Sables d'Or`, type: "single_family", address: "12 Bd du Front de Mer", city: "Oran", state: null, zip: "31000", year_built: 1995, notes: "OBS:D premium tenant", color: "emerald", country: "DZ", wilaya: "Oran", commune: "Oran" },
    { handle: "p3", name: `${OBS} Immeuble des Oliviers`, type: "multi_family", address: "8 Rue de la Liberté", city: "Alger", state: null, zip: "16000", year_built: 1965, notes: "OBS:E,F,G,H mixed ledger", color: "amber", country: "DZ", wilaya: "Alger", commune: "Bab El Oued" },
    { handle: "p4", name: `${OBS} Bastion 23`, type: "single_family", address: "23 Rue Sansonnet", city: "Constantine", state: null, zip: "25000", year_built: 2003, notes: "OBS:B vacant property", color: "slate", country: "DZ", wilaya: "Constantine", commune: "Constantine" },
    { handle: "p5", name: `${OBS} Résidence Tassili`, type: "multi_family", address: "3 Cité Aïssat Idir", city: "Tizi Ouzou", state: null, zip: "15000", year_built: 1988, notes: "OBS:C maintenance issue", color: "rose", country: "DZ", wilaya: "Tizi Ouzou", commune: "Tizi Ouzou" },
    { handle: "p6", name: `${OBS} Dar El Bahia`, type: "single_family", address: "45 Chemin de Trouville", city: "Oran", state: null, zip: "31000", year_built: 2010, notes: "OBS:I expired lease, turnover", color: "violet", country: "DZ", wilaya: "Oran", commune: "Bir El Djir" },
    { handle: "p7", name: `${OBS} Eucalyptus Gardens`, type: "multi_family", address: "21 Rue des Frères Bouadou", city: "Sétif", state: null, zip: "19000", year_built: 1999, notes: "OBS:L vendor & WO lifecycle", color: "lime", country: "DZ", wilaya: "Sétif", commune: "El Eulma" },
    { handle: "p8", name: `${OBS} Cité des Palmiers`, type: "multi_family", address: "9 Avenue 1er Novembre", city: "Blida", state: null, zip: "09000", year_built: 1982, notes: "OBS:J,K,M occupancy boundary + reconciliation", color: "cyan", country: "DZ", wilaya: "Blida", commune: "Blida" },
  ];

  // Units — 18 (13 occupied / 3 vacant / 2 turnover). sqft carries m².
  const units: UnitSpec[] = [
    { handle: "u-a1", prop: "p1", name: "Appartement 1", bedrooms: 2, bathrooms: 1, sqft: 68, market_rent: 45000, status: "occupied", notes: "OBS:A; m² convention" },
    { handle: "u-a2", prop: "p1", name: "Appartement 2", bedrooms: 1, bathrooms: 1, sqft: 52, market_rent: 38000, status: "occupied", notes: "OBS:A; m² convention" },
    { handle: "u-a3", prop: "p1", name: "Appartement 3", bedrooms: 3, bathrooms: 2, sqft: 96, market_rent: 62000, status: "occupied", notes: "OBS:A; m² convention" },
    { handle: "u-v1", prop: "p2", name: "Villa principale", bedrooms: 4, bathrooms: 3, sqft: 210, market_rent: 95000, status: "occupied", notes: "OBS:D" },
    { handle: "u-o1", prop: "p3", name: "Appartement 101", bedrooms: 2, bathrooms: 1, sqft: 60, market_rent: 42000, status: "occupied", notes: "OBS:F overdue" },
    { handle: "u-o2", prop: "p3", name: "Appartement 102", bedrooms: 1, bathrooms: 1, sqft: 45, market_rent: 35000, status: "occupied", notes: "OBS:E partial" },
    { handle: "u-o3", prop: "p3", name: "Studio 201", bedrooms: 0, bathrooms: 1, sqft: 30, market_rent: 28000, status: "occupied", notes: "OBS:G waived" },
    { handle: "u-o4", prop: "p3", name: "Appartement 202", bedrooms: 2, bathrooms: 1, sqft: 58, market_rent: 40000, status: "vacant", notes: "OBS:H future lease" },
    { handle: "u-b1", prop: "p4", name: "Maison principale", bedrooms: 3, bathrooms: 2, sqft: 140, market_rent: 55000, status: "vacant", notes: "OBS:B" },
    { handle: "u-t1", prop: "p5", name: "Appartement 1", bedrooms: 2, bathrooms: 1, sqft: 58, market_rent: 39000, status: "occupied", notes: "OBS:C leak reporter" },
    { handle: "u-t2", prop: "p5", name: "Appartement 2", bedrooms: 1, bathrooms: 1, sqft: 46, market_rent: 34000, status: "occupied", notes: "OBS:C boiler inspection" },
    { handle: "u-d1", prop: "p6", name: "Dar principale", bedrooms: 3, bathrooms: 2, sqft: 125, market_rent: 48000, status: "turnover", notes: "OBS:I manual turnover" },
    { handle: "u-e1", prop: "p7", name: "Appartement A", bedrooms: 2, bathrooms: 1, sqft: 55, market_rent: 36000, status: "occupied", notes: "OBS:L; ends T+24" },
    { handle: "u-e2", prop: "p7", name: "Appartement B", bedrooms: 1, bathrooms: 1, sqft: 44, market_rent: 32000, status: "occupied", notes: "OBS:L" },
    { handle: "u-e3", prop: "p7", name: "Studio C", bedrooms: 0, bathrooms: 1, sqft: 31, market_rent: 26000, status: "turnover", notes: "OBS:L manual turnover" },
    { handle: "u-c1", prop: "p8", name: "Appartement 1", bedrooms: 2, bathrooms: 1, sqft: 56, market_rent: 37000, status: "occupied", notes: "OBS:M 3 payments" },
    { handle: "u-c2", prop: "p8", name: "Appartement 2", bedrooms: 1, bathrooms: 1, sqft: 47, market_rent: 33000, status: "occupied", notes: "OBS:F partial overdue" },
    { handle: "u-c3", prop: "p8", name: "Appartement 3", bedrooms: 2, bathrooms: 2, sqft: 88, market_rent: 58000, status: "vacant", notes: "OBS:J cancelled+ended+upcoming" },
  ];

  // Tenants — 16 (each ≥1.5× rent income; synthetic obs emails).
  const tenants: TenantSpec[] = [
    { handle: "t-amine", first_name: "Amine", last_name: "Benali", email: "obs.amine@example.com", phone: "+213 555 10 20 01", employer: "SARL AlgerSoft", monthly_income: 90000, notes: "OBS:A" },
    { handle: "t-yasmine", first_name: "Yasmine", last_name: "Khelifi", email: "obs.yasmine@example.com", phone: "+213 555 10 20 02", employer: "École Les Orangers", monthly_income: 68000, notes: "OBS:A; lease ends T+55" },
    { handle: "t-karim", first_name: "Karim", last_name: "Boudiaf", email: "obs.karim@example.com", phone: "+213 555 10 20 03", employer: "Pharmacie Centrale", monthly_income: 120000, notes: "OBS:A" },
    { handle: "t-nora", first_name: "Nora", last_name: "Sebbagh", email: "obs.nora@example.com", phone: "+213 555 10 20 04", employer: "Clinique Yasmine", monthly_income: 180000, notes: "OBS:D" },
    { handle: "t-sofiane", first_name: "Sofiane", last_name: "Guerroudj", email: "obs.sofiane@example.com", phone: "+213 555 10 20 05", employer: "SARL Transport Alpha", monthly_income: 60000, notes: "OBS:F 2 months overdue" },
    { handle: "t-meriem", first_name: "Meriem", last_name: "Haddad", email: "obs.meriem@example.com", phone: "+213 555 10 20 06", employer: "Studio Créa Design", monthly_income: 70000, notes: "OBS:E partial" },
    { handle: "t-rabah", first_name: "Rabah", last_name: "Zitouni", email: "obs.rabah@example.com", phone: "+213 555 10 20 07", employer: "Retraite (pension)", monthly_income: 45000, notes: "OBS:G waived month" },
    { handle: "t-ines", first_name: "Ines", last_name: "Boulifa", email: "obs.ines@example.com", phone: "+213 555 10 20 08", employer: "Groupe Télécom DZ", monthly_income: 78000, notes: "OBS:H prior ended lease + upcoming T+14" },
    { handle: "t-hakim", first_name: "Hakim", last_name: "Ait Ahmed", email: "obs.hakim@example.com", phone: "+213 555 10 20 09", employer: "Garage Atlas", monthly_income: 72000, notes: "OBS:C" },
    { handle: "t-salima", first_name: "Salima", last_name: "Ouahrani", email: "obs.salima@example.com", phone: "+213 555 10 20 10", employer: "CHU Nedir", monthly_income: 66000, notes: "OBS:C" },
    { handle: "t-tarek", first_name: "Tarek", last_name: "Mansouri", email: "obs.tarek@example.com", phone: "+213 555 10 20 11", employer: "Cabinet Comptable Oran", monthly_income: 95000, notes: "OBS:I ended T-7" },
    { handle: "t-fares", first_name: "Fares", last_name: "Cherif", email: "obs.fares@example.com", phone: "+213 555 10 20 12", employer: "SARL Sonelgaz Régie", monthly_income: 70000, notes: "OBS:L,J ends E1 + upcoming C3" },
    { handle: "t-wafa", first_name: "Wafa", last_name: "Seddiki", email: "obs.wafa@example.com", phone: "+213 555 10 20 13", employer: "SARL Horizon RH", monthly_income: 62000, notes: "OBS:L" },
    { handle: "t-nabil", first_name: "Nabil", last_name: "Bouzid", email: "obs.nabil@example.com", phone: "+213 555 10 20 14", employer: "Bouzid Épicerie", monthly_income: 74000, notes: "OBS:M 3 payments; lease ends T+21" },
    { handle: "t-lamia", first_name: "Lamia", last_name: "Ferhat", email: "obs.lamia@example.com", phone: "+213 555 10 20 15", employer: "Université de Blida", monthly_income: 58000, notes: "OBS:F partial overdue" },
    { handle: "t-mourad", first_name: "Mourad", last_name: "Sahli", email: "obs.mourad@example.com", phone: "+213 555 10 20 16", employer: "Lycée Sinaa", monthly_income: 88000, notes: "OBS:J ended T-31" },
  ];

  // Leases — 19 (13 active / 2 upcoming / 3 ended / 1 cancelled).
  const leases: LeaseSpec[] = [
    { handle: "L-a1", unit: "u-a1", tenant: "t-amine", start: d(-400), end: d(330), monthly_rent: 45000, deposit: 90000, rent_due_day: 1, late_fee: 3000, status: "active", notes: "OBS:A,D" },
    { handle: "L-a2", unit: "u-a2", tenant: "t-yasmine", start: d(-300), end: d(55), monthly_rent: 38000, deposit: 76000, rent_due_day: 1, late_fee: 2000, status: "active", notes: "OBS:A,D; ends T+55" },
    { handle: "L-a3", unit: "u-a3", tenant: "t-karim", start: d(-90), end: d(275), monthly_rent: 62000, deposit: 124000, rent_due_day: 1, late_fee: 4000, status: "active", notes: "OBS:A,D" },
    { handle: "L-v1", unit: "u-v1", tenant: "t-nora", start: d(-550), end: d(180), monthly_rent: 95000, deposit: 190000, rent_due_day: 1, late_fee: 5000, status: "active", notes: "OBS:D" },
    { handle: "L-o1", unit: "u-o1", tenant: "t-sofiane", start: d(-120), end: d(245), monthly_rent: 42000, deposit: 84000, rent_due_day: 3, late_fee: 2000, status: "active", notes: "OBS:F overdue" },
    { handle: "L-o2", unit: "u-o2", tenant: "t-meriem", start: d(-60), end: d(300), monthly_rent: 35000, deposit: 70000, rent_due_day: 2, late_fee: 2000, status: "active", notes: "OBS:E partial" },
    { handle: "L-o3", unit: "u-o3", tenant: "t-rabah", start: d(-250), end: d(115), monthly_rent: 28000, deposit: 56000, rent_due_day: 1, late_fee: 1500, status: "active", notes: "OBS:G waived M0" },
    { handle: "L-t1", unit: "u-t1", tenant: "t-hakim", start: d(-45), end: d(320), monthly_rent: 39000, deposit: 78000, rent_due_day: 1, late_fee: 2000, status: "active", notes: "OBS:C,D" },
    { handle: "L-t2", unit: "u-t2", tenant: "t-salima", start: d(-180), end: d(185), monthly_rent: 34000, deposit: 68000, rent_due_day: 1, late_fee: 2000, status: "active", notes: "OBS:C,D" },
    { handle: "L-e1", unit: "u-e1", tenant: "t-fares", start: d(-30), end: d(24), monthly_rent: 36000, deposit: 72000, rent_due_day: 1, late_fee: 2000, status: "active", notes: "OBS:L,D; ends T+24, tenant moves to C3" },
    { handle: "L-e2", unit: "u-e2", tenant: "t-wafa", start: d(-120), end: d(245), monthly_rent: 32000, deposit: 64000, rent_due_day: 1, late_fee: 2000, status: "active", notes: "OBS:L,D" },
    { handle: "L-c1", unit: "u-c1", tenant: "t-nabil", start: d(-150), end: d(21), monthly_rent: 37000, deposit: 74000, rent_due_day: 1, late_fee: 2000, status: "active", notes: "OBS:M,D; ends T+21" },
    { handle: "L-c2", unit: "u-c2", tenant: "t-lamia", start: d(-75), end: d(290), monthly_rent: 33000, deposit: 66000, rent_due_day: 2, late_fee: 2000, status: "active", notes: "OBS:F partial overdue" },
    { handle: "L-o4u", unit: "u-o4", tenant: "t-ines", start: d(14), end: d(379), monthly_rent: 40000, deposit: 80000, rent_due_day: 1, late_fee: 2000, status: "upcoming", notes: "OBS:H starts T+14" },
    { handle: "L-c3u", unit: "u-c3", tenant: "t-fares", start: d(30), end: d(395), monthly_rent: 58000, deposit: 116000, rent_due_day: 1, late_fee: 3000, status: "upcoming", notes: "OBS:J starts T+30" },
    { handle: "L-o4e", unit: "u-o4", tenant: "t-ines", start: d(-380), end: d(-1), monthly_rent: 40000, deposit: 80000, rent_due_day: 1, late_fee: 2000, status: "ended", notes: "OBS:H prior lease, ended T-1" },
    { handle: "L-d1e", unit: "u-d1", tenant: "t-tarek", start: d(-400), end: d(-7), monthly_rent: 48000, deposit: 96000, rent_due_day: 1, late_fee: 2000, status: "ended", notes: "OBS:I ended T-7" },
    { handle: "L-c3e", unit: "u-c3", tenant: "t-mourad", start: d(-120), end: d(-31), monthly_rent: 58000, deposit: 116000, rent_due_day: 1, late_fee: 3000, status: "ended", notes: "OBS:J ended T-31" },
    { handle: "L-c3c", unit: "u-c3", tenant: null, start: d(-150), end: d(-90), monthly_rent: 58000, deposit: 0, rent_due_day: 1, late_fee: 0, status: "cancelled", notes: "OBS:J draft annulé avant signature" },
  ];

  // Charges — 43. Statuses pre-normalized at anchor (markOverdue is a no-op).
  const charges: ChargeSpec[] = [];
  const ch = (c: ChargeSpec) => { charges.push(c); };

  // 13 active leases × M0 (statuses per scenario)
  ch({ handle: "c-a1-m0", lease: "L-a1", period: m0, due_date: dueDateFor(m0, 1), amount: 45000, amount_paid: 45000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-a2-m0", lease: "L-a2", period: m0, due_date: dueDateFor(m0, 1), amount: 38000, amount_paid: 38000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-a3-m0", lease: "L-a3", period: m0, due_date: dueDateFor(m0, 1), amount: 62000, amount_paid: 62000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-v1-m0", lease: "L-v1", period: m0, due_date: dueDateFor(m0, 1), amount: 95000, amount_paid: 95000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-o1-m0", lease: "L-o1", period: m0, due_date: d(-20), amount: 42000, amount_paid: 0, status: "overdue", notes: "OBS:F due T-20" });
  ch({ handle: "c-o2-m0", lease: "L-o2", period: m0, due_date: d(6), amount: 35000, amount_paid: 20000, status: "partial", notes: "OBS:E due T+6 (stable partial)" });
  ch({ handle: "c-o3-m0", lease: "L-o3", period: m0, due_date: dueDateFor(m0, 1), amount: 28000, amount_paid: 0, status: "waived", notes: "OBS:G waived" });
  ch({ handle: "c-t1-m0", lease: "L-t1", period: m0, due_date: dueDateFor(m0, 1), amount: 39000, amount_paid: 39000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-t2-m0", lease: "L-t2", period: m0, due_date: dueDateFor(m0, 1), amount: 34000, amount_paid: 34000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-e1-m0", lease: "L-e1", period: m0, due_date: dueDateFor(m0, 1), amount: 36000, amount_paid: 36000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-e2-m0", lease: "L-e2", period: m0, due_date: dueDateFor(m0, 1), amount: 32000, amount_paid: 32000, status: "paid", notes: "OBS:D" });
  ch({ handle: "c-c1-m0", lease: "L-c1", period: m0, due_date: dueDateFor(m0, 1), amount: 37000, amount_paid: 37000, status: "paid", notes: "OBS:M 3 payments" });
  ch({ handle: "c-c2-m0", lease: "L-c2", period: m0, due_date: d(-25), amount: 33000, amount_paid: 15000, status: "overdue", notes: "OBS:F due T-25, partial past-due → overdue" });

  // 13 active leases × M-1 (all paid except O1 overdue)
  const m1Arr: Array<{ h: string; lease: string; amount: number; status?: "overdue"; due_day?: number }> = [
    { h: "c-a1-m1", lease: "L-a1", amount: 45000 },
    { h: "c-a2-m1", lease: "L-a2", amount: 38000 },
    { h: "c-a3-m1", lease: "L-a3", amount: 62000 },
    { h: "c-v1-m1", lease: "L-v1", amount: 95000 },
    { h: "c-o1-m1", lease: "L-o1", amount: 42000, status: "overdue", due_day: 3 },
    { h: "c-o2-m1", lease: "L-o2", amount: 35000 },
    { h: "c-o3-m1", lease: "L-o3", amount: 28000 },
    { h: "c-t1-m1", lease: "L-t1", amount: 39000 },
    { h: "c-t2-m1", lease: "L-t2", amount: 34000 },
    { h: "c-e1-m1", lease: "L-e1", amount: 36000 },
    { h: "c-e2-m1", lease: "L-e2", amount: 32000 },
    { h: "c-c1-m1", lease: "L-c1", amount: 37000 },
    { h: "c-c2-m1", lease: "L-c2", amount: 33000 },
  ];
  for (const r of m1Arr) {
    ch({
      handle: r.h, lease: r.lease, period: m1, due_date: dueDateFor(m1, r.due_day ?? 1),
      amount: r.amount, amount_paid: r.status === "overdue" ? 0 : r.amount,
      status: r.status ?? "paid", notes: r.status === "overdue" ? "OBS:F due M-1-03 (past)" : "OBS:D",
    });
  }

  // 8 active leases × M-2 (all paid)
  const m2Arr: Array<{ h: string; lease: string; amount: number }> = [
    { h: "c-a1-m2", lease: "L-a1", amount: 45000 },
    { h: "c-a2-m2", lease: "L-a2", amount: 38000 },
    { h: "c-v1-m2", lease: "L-v1", amount: 95000 },
    { h: "c-o1-m2", lease: "L-o1", amount: 42000 },
    { h: "c-o3-m2", lease: "L-o3", amount: 28000 },
    { h: "c-t2-m2", lease: "L-t2", amount: 34000 },
    { h: "c-e2-m2", lease: "L-e2", amount: 32000 },
    { h: "c-c1-m2", lease: "L-c1", amount: 37000 },
  ];
  for (const r of m2Arr) {
    ch({ handle: r.h, lease: r.lease, period: m2, due_date: dueDateFor(m2, 1), amount: r.amount, amount_paid: r.amount, status: "paid", notes: "OBS:D" });
  }

  // Ended lease histories (9 charges)
  ch({ handle: "c-o4e-m3", lease: "L-o4e", period: m3, due_date: dueDateFor(m3, 1), amount: 40000, amount_paid: 40000, status: "paid", notes: "OBS:H" });
  ch({ handle: "c-o4e-m2", lease: "L-o4e", period: m2, due_date: dueDateFor(m2, 1), amount: 40000, amount_paid: 40000, status: "paid", notes: "OBS:H" });
  ch({ handle: "c-o4e-m1", lease: "L-o4e", period: m1, due_date: dueDateFor(m1, 1), amount: 40000, amount_paid: 40000, status: "paid", notes: "OBS:H" });
  ch({ handle: "c-d1e-m3", lease: "L-d1e", period: m3, due_date: dueDateFor(m3, 1), amount: 48000, amount_paid: 48000, status: "paid", notes: "OBS:I" });
  ch({ handle: "c-d1e-m2", lease: "L-d1e", period: m2, due_date: dueDateFor(m2, 1), amount: 48000, amount_paid: 48000, status: "paid", notes: "OBS:I" });
  ch({ handle: "c-d1e-m1", lease: "L-d1e", period: m1, due_date: dueDateFor(m1, 1), amount: 48000, amount_paid: 48000, status: "paid", notes: "OBS:I" });
  ch({ handle: "c-c3e-m4", lease: "L-c3e", period: m4, due_date: dueDateFor(m4, 1), amount: 58000, amount_paid: 58000, status: "paid", notes: "OBS:J" });
  ch({ handle: "c-c3e-m3", lease: "L-c3e", period: m3, due_date: dueDateFor(m3, 1), amount: 58000, amount_paid: 58000, status: "paid", notes: "OBS:J" });
  ch({ handle: "c-c3e-m2", lease: "L-c3e", period: m2, due_date: dueDateFor(m2, 1), amount: 58000, amount_paid: 58000, status: "paid", notes: "OBS:J" });

  // Payments — 43, exactly covering every non-zero amount_paid.
  const payments: PaymentSpec[] = [];
  const pay = (p: PaymentSpec) => { payments.push(p); };
  // M0: 8 singles + C1×3
  pay({ handle: "pay-a1-m0", charge: "c-a1-m0", paid_at: dueDateFor(m0, 5), amount: 45000, method: "ach", reference: "VIR-2026-09-A1", notes: "OBS:D" });
  pay({ handle: "pay-a2-m0", charge: "c-a2-m0", paid_at: dueDateFor(m0, 6), amount: 38000, method: "cash", reference: "", notes: "OBS:D" });
  pay({ handle: "pay-a3-m0", charge: "c-a3-m0", paid_at: dueDateFor(m0, 8), amount: 62000, method: "credit", reference: "CB-8842", notes: "OBS:D" });
  pay({ handle: "pay-v1-m0", charge: "c-v1-m0", paid_at: dueDateFor(m0, 7), amount: 95000, method: "ach", reference: "VIR-2026-09-V1", notes: "OBS:D" });
  pay({ handle: "pay-t1-m0", charge: "c-t1-m0", paid_at: dueDateFor(m0, 10), amount: 39000, method: "check", reference: "Chèque n°1201", notes: "OBS:D" });
  pay({ handle: "pay-t2-m0", charge: "c-t2-m0", paid_at: dueDateFor(m0, 4), amount: 34000, method: "cash", reference: "", notes: "OBS:D" });
  pay({ handle: "pay-e1-m0", charge: "c-e1-m0", paid_at: dueDateFor(m0, 12), amount: 36000, method: "ach", reference: "VIR-2026-09-E1", notes: "OBS:D" });
  pay({ handle: "pay-e2-m0", charge: "c-e2-m0", paid_at: dueDateFor(m0, 9), amount: 32000, method: "check", reference: "Chèque n°1202", notes: "OBS:D" });
  pay({ handle: "pay-c1-m0-1", charge: "c-c1-m0", paid_at: d(-9), amount: 15000, method: "check", reference: "Chèque n°1142", notes: "OBS:M" });
  pay({ handle: "pay-c1-m0-2", charge: "c-c1-m0", paid_at: d(-6), amount: 17000, method: "ach", reference: "VIR-2026-091", notes: "OBS:M" });
  pay({ handle: "pay-c1-m0-3", charge: "c-c1-m0", paid_at: d(-5), amount: 5000, method: "cash", reference: "", notes: "OBS:M" });
  pay({ handle: "pay-o2-m0", charge: "c-o2-m0", paid_at: d(-1), amount: 20000, method: "check", reference: "Chèque n°1143", notes: "OBS:E partial" });
  pay({ handle: "pay-c2-m0", charge: "c-c2-m0", paid_at: d(-8), amount: 15000, method: "cash", reference: "", notes: "OBS:F partial" });
  // M-1: 12 paid leases, O3 split in 2
  pay({ handle: "pay-a1-m1", charge: "c-a1-m1", paid_at: dueDateFor(m1, 5), amount: 45000, method: "ach", reference: "VIR-2026-08-A1", notes: "OBS:D" });
  pay({ handle: "pay-a2-m1", charge: "c-a2-m1", paid_at: dueDateFor(m1, 6), amount: 38000, method: "cash", reference: "", notes: "OBS:D" });
  pay({ handle: "pay-a3-m1", charge: "c-a3-m1", paid_at: dueDateFor(m1, 8), amount: 62000, method: "check", reference: "Chèque n°1188", notes: "OBS:D" });
  pay({ handle: "pay-v1-m1", charge: "c-v1-m1", paid_at: dueDateFor(m1, 7), amount: 95000, method: "ach", reference: "VIR-2026-08-V1", notes: "OBS:D" });
  pay({ handle: "pay-o2-m1", charge: "c-o2-m1", paid_at: dueDateFor(m1, 10), amount: 35000, method: "check", reference: "Chèque n°1189", notes: "OBS:E" });
  pay({ handle: "pay-o3-m1-1", charge: "c-o3-m1", paid_at: dueDateFor(m1, 4), amount: 15000, method: "check", reference: "Chèque n°1190", notes: "OBS:G split" });
  pay({ handle: "pay-o3-m1-2", charge: "c-o3-m1", paid_at: dueDateFor(m1, 6), amount: 13000, method: "cash", reference: "", notes: "OBS:G split" });
  pay({ handle: "pay-t1-m1", charge: "c-t1-m1", paid_at: dueDateFor(m1, 11), amount: 39000, method: "check", reference: "Chèque n°1191", notes: "OBS:D" });
  pay({ handle: "pay-t2-m1", charge: "c-t2-m1", paid_at: dueDateFor(m1, 9), amount: 34000, method: "ach", reference: "VIR-2026-08-T2", notes: "OBS:D" });
  pay({ handle: "pay-e1-m1", charge: "c-e1-m1", paid_at: dueDateFor(m1, 12), amount: 36000, method: "cash", reference: "", notes: "OBS:D" });
  pay({ handle: "pay-e2-m1", charge: "c-e2-m1", paid_at: dueDateFor(m1, 8), amount: 32000, method: "ach", reference: "VIR-2026-08-E2", notes: "OBS:D" });
  pay({ handle: "pay-c1-m1", charge: "c-c1-m1", paid_at: dueDateFor(m1, 5), amount: 37000, method: "cash", reference: "", notes: "OBS:M" });
  pay({ handle: "pay-c2-m1", charge: "c-c2-m1", paid_at: dueDateFor(m1, 6), amount: 33000, method: "ach", reference: "VIR-2026-08-C2", notes: "OBS:F" });
  // M-2: 8
  pay({ handle: "pay-a1-m2", charge: "c-a1-m2", paid_at: dueDateFor(m2, 5), amount: 45000, method: "other", reference: "Virement intl. 55120", notes: "OBS:D" });
  pay({ handle: "pay-a2-m2", charge: "c-a2-m2", paid_at: dueDateFor(m2, 6), amount: 38000, method: "cash", reference: "", notes: "OBS:D" });
  pay({ handle: "pay-v1-m2", charge: "c-v1-m2", paid_at: dueDateFor(m2, 7), amount: 95000, method: "ach", reference: "VIR-2026-07-V1", notes: "OBS:D" });
  pay({ handle: "pay-o1-m2", charge: "c-o1-m2", paid_at: dueDateFor(m2, 9), amount: 42000, method: "check", reference: "Chèque n°1166", notes: "OBS:F (was on time 2 months ago)" });
  pay({ handle: "pay-o3-m2", charge: "c-o3-m2", paid_at: dueDateFor(m2, 5), amount: 28000, method: "cash", reference: "", notes: "OBS:G" });
  pay({ handle: "pay-t2-m2", charge: "c-t2-m2", paid_at: dueDateFor(m2, 8), amount: 34000, method: "check", reference: "Chèque n°1167", notes: "OBS:D" });
  pay({ handle: "pay-e2-m2", charge: "c-e2-m2", paid_at: dueDateFor(m2, 6), amount: 32000, method: "cash", reference: "", notes: "OBS:D" });
  pay({ handle: "pay-c1-m2", charge: "c-c1-m2", paid_at: dueDateFor(m2, 7), amount: 37000, method: "check", reference: "Chèque n°1168", notes: "OBS:M" });
  // Ended histories (9)
  pay({ handle: "pay-o4e-m3", charge: "c-o4e-m3", paid_at: dueDateFor(m3, 10), amount: 40000, method: "cash", reference: "", notes: "OBS:H" });
  pay({ handle: "pay-o4e-m2", charge: "c-o4e-m2", paid_at: dueDateFor(m2, 12), amount: 40000, method: "check", reference: "Chèque n°1145", notes: "OBS:H" });
  pay({ handle: "pay-o4e-m1", charge: "c-o4e-m1", paid_at: dueDateFor(m1, 15), amount: 40000, method: "ach", reference: "VIR-2026-08-O4", notes: "OBS:H" });
  pay({ handle: "pay-d1e-m3", charge: "c-d1e-m3", paid_at: dueDateFor(m3, 14), amount: 48000, method: "check", reference: "Chèque n°1130", notes: "OBS:I" });
  pay({ handle: "pay-d1e-m2", charge: "c-d1e-m2", paid_at: dueDateFor(m2, 16), amount: 48000, method: "ach", reference: "VIR-2026-07-D1", notes: "OBS:I" });
  pay({ handle: "pay-d1e-m1", charge: "c-d1e-m1", paid_at: dueDateFor(m1, 18), amount: 48000, method: "check", reference: "Chèque n°1155", notes: "OBS:I" });
  pay({ handle: "pay-c3e-m4", charge: "c-c3e-m4", paid_at: dueDateFor(m4, 5), amount: 58000, method: "cash", reference: "", notes: "OBS:J" });
  pay({ handle: "pay-c3e-m3", charge: "c-c3e-m3", paid_at: dueDateFor(m3, 6), amount: 58000, method: "check", reference: "Chèque n°1120", notes: "OBS:J" });
  pay({ handle: "pay-c3e-m2", charge: "c-c3e-m2", paid_at: dueDateFor(m2, 8), amount: 58000, method: "ach", reference: "VIR-2026-07-C3", notes: "OBS:J" });

  // Vendors — 7 (portfolio directory).
  const vendors: VendorSpec[] = [
    { handle: "v1", name: "SARL HydraPlomberie", category: "plumber", phone: "+213 555 21 30 01", email: "obs.plomberie@example.com", notes: "OBS:L", color: "sky" },
    { handle: "v2", name: "Élec Oran Services", category: "electrician", phone: "+213 555 21 30 02", email: "obs.elec@example.com", notes: "OBS:L", color: "amber" },
    { handle: "v3", name: "FrigoClim Tizi", category: "hvac", phone: "+213 555 21 30 03", email: "obs.frigoclim@example.com", notes: "OBS:C", color: "emerald" },
    { handle: "v4", name: "Nettoyage Pro Alger", category: "cleaning", phone: "+213 555 21 30 04", email: "obs.nettoyage@example.com", notes: "OBS:L", color: "violet" },
    { handle: "v5", name: "Jardins & Espaces Verts", category: "landscaping", phone: "+213 555 21 30 05", email: "obs.jardins@example.com", notes: "OBS:L", color: "lime" },
    { handle: "v6", name: "Atelier Fer & Bois", category: "handyman", phone: "+213 555 21 30 06", email: "obs.atelier@example.com", notes: "OBS:L", color: "rose" },
    { handle: "v7", name: "Maintenance Générale DH", category: "general", phone: "+213 555 21 30 07", email: "obs.maintenance@example.com", notes: "OBS:P standby contractor", color: "slate" },
  ];

  // Work orders — 10 (5 non-terminal / 4 completed / 1 cancelled).
  const workOrders: WorkOrderSpec[] = [
    { handle: "wo-1", prop: "p5", unit: "u-t1", tenant: "t-hakim", vendor: null, title: "Fuite de toiture — appartement 1", description: "Infiltration au plafond du salon après fortes pluies; vidange en cours, à traiter en urgence.", priority: "urgent", status: "open", scheduled_at: null, completed_at: null, cost: null, notes: "OBS:C" },
    { handle: "wo-2", prop: "p5", unit: "u-t2", tenant: "t-salima", vendor: "v3", title: "Contrôle chaudière gaz", description: "Inspection annuelle obligatoire de la chaudière collective de l'immeuble.", priority: "high", status: "assigned", scheduled_at: d(2), completed_at: null, cost: null, notes: "OBS:C" },
    { handle: "wo-3", prop: "p8", unit: "u-c2", tenant: "t-lamia", vendor: null, title: "Fuite robinet cuisine", description: "Robinettrie qui goutte; joint à remplacer.", priority: "high", status: "open", scheduled_at: null, completed_at: null, cost: null, notes: "OBS:P leak-sink" },
    { handle: "wo-4", prop: "p1", unit: null, tenant: null, vendor: null, title: "Contrôle chauffe-eau commun", description: "Maintenance préventive du chauffe-eau des parties communes.", priority: "low", status: "open", scheduled_at: null, completed_at: null, cost: null, notes: "OBS:P water-heater low" },
    { handle: "wo-5", prop: "p7", unit: "u-e1", tenant: "t-fares", vendor: "v1", title: "Débouchage canalisation", description: "Canalisation de la cuisine bouchée; intervention en cours.", priority: "normal", status: "in_progress", scheduled_at: d(-1), completed_at: null, cost: null, notes: "OBS:L" },
    { handle: "wo-6", prop: "p7", unit: "u-e1", tenant: "t-fares", vendor: "v1", title: "Remplacement joint WC", description: "Joint de cuvette remplacé.", priority: "normal", status: "completed", scheduled_at: d(-13), completed_at: d(-12), cost: 8000, notes: "OBS:L" },
    { handle: "wo-7", prop: "p7", unit: null, tenant: null, vendor: "v5", title: "Peinture façade", description: "Rafraîchissement de la façade de l'immeuble.", priority: "normal", status: "completed", scheduled_at: d(-31), completed_at: d(-30), cost: 45000, notes: "OBS:L" },
    { handle: "wo-8", prop: "p5", unit: "u-t1", tenant: "t-hakim", vendor: "v2", title: "Réparation fenêtre salon", description: "Vitre fêlée remplacée et poignée réparée.", priority: "normal", status: "completed", scheduled_at: d(-16), completed_at: d(-15), cost: 6500, notes: "OBS:L" },
    { handle: "wo-9", prop: "p7", unit: "u-e3", tenant: null, vendor: "v6", title: "Aménagement terrasse — annulé", description: "Projet d'aménagement suspendu par le propriétaire.", priority: "low", status: "cancelled", scheduled_at: null, completed_at: null, cost: null, notes: "OBS:L" },
    { handle: "wo-10", prop: "p7", unit: "u-e3", tenant: null, vendor: "v4", title: "Nettoyage après départ", description: "Remise en état du studio après départ du locataire.", priority: "normal", status: "completed", scheduled_at: d(-3), completed_at: d(-2), cost: 12000, notes: "OBS:L" },
  ];

  // Applications — 8 (all 5 statuses).
  const applications: ApplicationSpec[] = [
    { handle: "app-1", unit: "u-d1", first_name: "Yacine", last_name: "Belkacem", email: "obs.app1@example.com", phone: "+213 555 30 40 01", monthly_income: 90000, employer: "SARL Atlas Immobilier", desired_move_in: d(20), status: "new", notes: "OBS:K new" },
    { handle: "app-2", unit: "u-d1", first_name: "Sonia", last_name: "Merabet", email: "obs.app2@example.com", phone: "+213 555 30 40 02", monthly_income: 70000, employer: "Algérie Télécom", desired_move_in: d(15), status: "screening", notes: "OBS:K screening" },
    { handle: "app-3", unit: "u-d1", first_name: "Riad", last_name: "Cherif", email: "obs.app3@example.com", phone: "+213 555 30 40 03", monthly_income: 40000, employer: "SARL Fast Transport", desired_move_in: d(10), status: "declined", notes: "OBS:K declined — income < 1.5× rent" },
    { handle: "app-4", unit: "u-o4", first_name: "Ines", last_name: "Boulifa", email: "obs.ines@example.com", phone: "+213 555 10 20 08", monthly_income: 78000, employer: "Groupe Télécom DZ", desired_move_in: d(14), status: "approved", notes: "OBS:K approved — matches upcoming lease T+14" },
    { handle: "app-5", unit: "u-c3", first_name: "Walid", last_name: "Saadi", email: "obs.app5@example.com", phone: "+213 555 30 40 05", monthly_income: 110000, employer: "SARL Construction El Amel", desired_move_in: d(40), status: "new", notes: "OBS:K new" },
    { handle: "app-6", unit: "u-c3", first_name: "Chafia", last_name: "Benaissa", email: "obs.app6@example.com", phone: "+213 555 30 40 06", monthly_income: 95000, employer: "Clinique El Hayat", desired_move_in: d(35), status: "screening", notes: "OBS:K screening" },
    { handle: "app-7", unit: "u-c3", first_name: "Nadia", last_name: "Ziani", email: "obs.app7@example.com", phone: "+213 555 30 40 07", monthly_income: 105000, employer: "Banque Nationale", desired_move_in: d(32), status: "withdrawn", notes: "OBS:K withdrawn" },
    { handle: "app-8", unit: "u-b1", first_name: "Adel", last_name: "Mansouri", email: "obs.app8@example.com", phone: "+213 555 30 40 08", monthly_income: 38000, employer: "Café Le Palmier", desired_move_in: d(5), status: "declined", notes: "OBS:K declined — income < 1.5× rent" },
  ];

  // Audit — 39 rows, every action a real writeAudit call site.
  // 19 lease creates + 3 rent_charge generates + 15 payment creates + 2 settings updates.
  const audit: AuditSpec[] = [];
  const lc = (lease: LeaseSpec) => audit.push({
    handle: `aud-lc-${lease.handle.toLowerCase()}`,
    actor: lease.handle.startsWith("L-a") || lease.handle === "L-v1" || lease.handle === "L-o4u" ? "u-admin"
      : lease.handle === "L-e1" || lease.handle === "L-c3c" ? "u-maint" : "u-fin",
    action: "create", entity: "lease", record: `@leases:${lease.handle}`,
    old_value: null,
    new_value: { unit_id: `@units:${lease.unit}`, start_date: lease.start, end_date: lease.end, monthly_rent: lease.monthly_rent, status: lease.status },
    created_at: lease.start,
  });
  for (const l of leases) lc(l);
  audit.push(
    { handle: "aud-gen-m2", actor: "u-fin", action: "generate", entity: "rent_charge", record: null, old_value: null, new_value: { period: m2, created: 8 }, created_at: `${m2}-01` },
    { handle: "aud-gen-m1", actor: "u-fin", action: "generate", entity: "rent_charge", record: null, old_value: null, new_value: { period: m1, created: 13 }, created_at: `${m1}-01` },
    { handle: "aud-gen-m0", actor: "u-fin", action: "generate", entity: "rent_charge", record: null, old_value: null, new_value: { period: m0, created: 13 }, created_at: `${m0}-01` },
  );
  const auditedPayments = [
    "pay-a1-m0", "pay-a2-m0", "pay-a3-m0", "pay-v1-m0", "pay-t1-m0", "pay-t2-m0", "pay-e1-m0", "pay-e2-m0",
    "pay-c1-m0-1", "pay-c1-m0-2", "pay-c1-m0-3", "pay-c2-m0", "pay-o2-m0", "pay-o3-m1-1", "pay-d1e-m1",
  ];
  for (const handle of auditedPayments) {
    const p = payments.find((x) => x.handle === handle);
    if (!p) throw new Error(`audit payment handle missing: ${handle}`);
    const chg = charges.find((c) => c.handle === p.charge);
    if (!chg) throw new Error(`charge handle missing for ${p.charge}`);
    audit.push({
      handle: `aud-pay-${handle.toLowerCase()}`,
      actor: "u-fin", action: "create", entity: "payment", record: `@payments:${handle}`,
      old_value: null,
      new_value: { charge_id: `@charges:${p.charge}`, amount: p.amount, method: p.method },
      created_at: p.paid_at,
    });
  }
  audit.push(
    { handle: "aud-set-locale", actor: "u-admin", action: "update", entity: "settings", record: null, old_value: { key: "locale", value: "en" }, new_value: { key: "locale", value: "fr-DZ" }, created_at: d(-200) },
    { handle: "aud-set-currency", actor: "u-admin", action: "update", entity: "settings", record: null, old_value: { key: "currency", value: "USD" }, new_value: { key: "currency", value: "DZD" }, created_at: d(-190) },
  );

  return { anchor: T, m0, properties, units, tenants, leases, charges, payments, vendors, workOrders, applications, users, audit };
}