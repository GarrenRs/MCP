# 04 — API

Base path: `/api`. JSON only. Errors return `{ "error": "<message>" }` with 4xx/5xx status.
No versioning prefix. `[VERIFIED — src/server/index.ts]`

## Conventions

- IDs: parsed via `intParam()`; non-numeric → `400 {error:"Invalid ID"}`.
- Writes: Zod schema on POST/PUT; failure → `400 {error:"field: issue; ..."}`.
- Create → `201`, update/delete/read → `200`, missing row → `404 {error:"Not found"}`.
- List endpoints accept query filters (see per entity). Several filters are **not used by the
  UI** (marked). `[VERIFIED]`
- No authentication, no tenant isolation, no rate limiting. See `09-risks.md`.
- `app.use("*")` runs `initDB(c.env)` + `ensureSeeded()` on **every** request `[VERIFIED]`.

## Endpoint catalog

### Health
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{ok:true}` (used to verify the running system) |

### Properties
| Method | Path | Notes |
|---|---|---|
| GET | `/api/properties` | joins `unit_count`, `occupied_count`; ordered by name |
| POST | `/api/properties` | create; default type `single_family`, color `sky` |
| GET | `/api/properties/:id` | single row or 404 |
| PUT | `/api/properties/:id` | partial update (`buildUpdate`) |
| DELETE | `/api/properties/:id` | cascades units→leases→charges→payments (FK ON) |

### Units
| Method | Path | Notes |
|---|---|---|
| GET | `/api/units` | filter `property_id`, `status`; joins property + active lease/tenant |
| POST | `/api/units` | requires `property_id`, `name`; defaults bedrooms/baths 1, status vacant |
| GET | `/api/units/:id` | single |
| PUT | `/api/units/:id` | partial update. **Note:** editing `status` here does NOT touch leases |
| DELETE | `/api/units/:id` | cascades leases→charges→payments |

### Tenants
| Method | Path | Notes |
|---|---|---|
| GET | `/api/tenants` | optional `?q=` server search (name/email/phone LIKE). UI does not use `q` (it loads all, LIMIT 500, and filters client-side) |
| POST | `/api/tenants` | requires `first_name`, `last_name` |
| GET | `/api/tenants/:id` | single |
| PUT | `/api/tenants/:id` | partial update |
| DELETE | `/api/tenants/:id` | `primary_tenant_id` on leases becomes NULL (history kept) |

### Leases
| Method | Path | Notes |
|---|---|---|
| GET | `/api/leases` | filters `status`, `tenant_id`, `unit_id`; joins tenant/property/unit. UI loads all and filters client-side |
| POST | `/api/leases` | `unit_id`, dates required. **Side-effect:** if status defaults/active → sets unit `occupied` |
| GET | `/api/leases/:id` | single |
| PUT | `/api/leases/:id` | partial update. **No** unit-vacating side-effect on ended/cancelled |
| DELETE | `/api/leases/:id` | cascades rent_charges→payments |

### Rent charges
| Method | Path | Notes |
|---|---|---|
| GET | `/api/rent-charges` | filters `period`, `status`; joins lease/unit/property/tenant |
| POST | `/api/rent-charges` | create one; `ON CONFLICT(lease_id, period) DO NOTHING`; returns existing if dup |
| POST | `/api/rent-charges/generate` | idempotent bulk for a `period`; also **re-marks overdue** |
| PUT | `/api/rent-charges/:id` | partial: amount / due_date / status (incl. `waived`) / notes. **No UI exists for editing a charge** |
| DELETE | `/api/rent-charges/:id` | cascades payments |

### Payments
| Method | Path | Notes |
|---|---|---|
| GET | `/api/rent-charges/:id/payments` | history for a charge |
| POST | `/api/payments` | inserts + **recomputes** charge `amount_paid`/`status` |
| DELETE | `/api/payments/:id` | removes + **recomputes** charge |

### Vendors
| Method | Path | Notes |
|---|---|---|
| GET | `/api/vendors` | ordered by name |
| POST | `/api/vendors` | requires name; category default `general`, color `slate` |
| PUT | `/api/vendors/:id` | partial update |
| DELETE | `/api/vendors/:id` | work_orders vendor_id → NULL (name is NOT preserved — UI copy says it is; see 06) |

### Work orders
| Method | Path | Notes |
|---|---|---|
| GET | `/api/work-orders` | filters `status`, `property_id`; joined property/unit/tenant/vendor; priority sort |
| POST | `/api/work-orders` | title required; priority `normal`, status `open` defaults |
| PUT | `/api/work-orders/:id` | partial update. `completed_at` settable via API but **no UI field** exists |
| DELETE | `/api/work-orders/:id` | hard delete |

### Applications (backend-only — no UI anywhere)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/applications` | joined unit/property; ordered by created_at desc |
| POST | `/api/applications` | first/last name required; status default `new` |
| PUT | `/api/applications/:id` | partial update |
| DELETE | `/api/applications/:id` | hard delete |

### Dashboard & settings
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard/summary` | portfolio counts, current-month rent stats, overdue, open/urgent WOs, recent open WOs, upcoming expirations (30/60-day windows). Uses `safeGet/safeQuery` (never 5xx on cold DB) |
| GET | `/api/settings` | merges hard-coded defaults + stored rows |
| PUT | `/api/settings` | upsert key/values; returns merged settings |

## Complete endpoint list (29) `[VERIFIED]`

1. GET /api/health
2. GET /api/properties
3. POST /api/properties
4. GET /api/properties/:id
5. PUT /api/properties/:id
6. DELETE /api/properties/:id
7. GET /api/units
8. POST /api/units
9. GET /api/units/:id
10. PUT /api/units/:id
11. DELETE /api/units/:id
12. GET /api/tenants
13. POST /api/tenants
14. GET /api/tenants/:id
15. PUT /api/tenants/:id
16. DELETE /api/tenants/:id
17. GET /api/leases
18. POST /api/leases
19. GET /api/leases/:id
20. PUT /api/leases/:id
21. DELETE /api/leases/:id
22. GET /api/rent-charges
23. POST /api/rent-charges
24. POST /api/rent-charges/generate
25. PUT /api/rent-charges/:id
26. DELETE /api/rent-charges/:id
27. GET /api/rent-charges/:id/payments
28. POST /api/payments
29. DELETE /api/payments/:id
30. GET /api/vendors
31. POST /api/vendors
32. PUT /api/vendors/:id
33. DELETE /api/vendors/:id
34. GET /api/work-orders
35. POST /api/work-orders
36. PUT /api/work-orders/:id
37. DELETE /api/work-orders/:id
38. GET /api/applications
39. POST /api/applications
40. PUT /api/applications/:id
41. DELETE /api/applications/:id
42. GET /api/dashboard/summary
43. GET /api/settings
44. PUT /api/settings

(44 entries — every route carries exactly one handler.)

## Backend features without UI (from this catalog)

- **Applications CRUD** (4 endpoints) — no screen, no route, no nav item, no client state hook,
  only the `Application`/`NewApplication` types. `[VERIFIED]`
- **Charge PATCH** — amounts, due dates, and `waived` status can only be changed via API.
- **Work-order `completed_at`** — settable only via API.
- **Server-side tenant search `?q=`** and **lease status filter** — implemented, unused by the UI.