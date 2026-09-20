# 14 — Brand Architecture (ORKESTRIX)

**Status**: authoritative project/business decision for this repository. This is **not** a
source-code fact — it is a directive, distinct from the `[VERIFIED]` code-versus-inference
evidence discipline used elsewhere in this documentation set.

---

## Master Brand

**ORKESTRIX** — the master brand for all commercial products. It is not restricted to desktop
software, "Systems", SaaS, cloud, or any single category.

## Product Naming Pattern

`ORKESTRIX + [Product] + [Type]`

- `[Product]` — what it does (Property, Rental, Inventory, CRM, SMTP, Image, …).
- `[Type]` — product descriptor: System, Tools, App, Studio, … varies per product.

## Current Product

**ORKESTRIX Property System** — the commercial, localized property-management product. Target V1:
Algerian market, French (`fr-DZ`) UI, DZD currency, per `Docs/13`–`13c`.

## Upstream / Open Source Origin

**OpenProperty** — the MIT-licensed open-source foundation this repo contains: source audit
baseline commit `98bfc4a`, stack as documented in `Docs/01`, plan source for V1.

## Relationship

| Identity | Role |
|---|---|
| OpenProperty | Upstream technical foundation (open source, self-hosted). |
| ORKESTRIX Property System | Commercial localized product **built from** that foundation. |

- OpenProperty and ORKESTRIX Property System are **not the same identity**.
- V1 work happens on the OpenProperty codebase but ships under the ORKESTRIX Property System
  identity.

## Commercial identity rule

- Where commercial product identity is required, use **ORKESTRIX Property System**.
- Never present **OpenProperty** as the commercial product.
- Do not remove or ignore required upstream attribution/licensing.

## Attribution / licensing distinction

- Upstream (OpenProperty) license: **MIT** — retained, visible, unmodified.
- Fork/source attribution: keep the upstream README/license attribution intact; commercial
  product identity does not erase it (`SPEC-14` for the product repo, upstream LICENSE preserved).
- The commercial product adds its own identity and terms on top of, never instead of, the
  upstream license.

## Brand extensibility

ORKESTRIX is extendable to any product line. Future products follow the same pattern. Company /
product line is not tied to property management.

## Naming examples

- ORKESTRIX Property System
- ORKESTRIX Rental System
- ORKESTRIX Inventory System
- ORKESTRIX CRM System
- ORKESTRIX SMTP Tools
- ORKESTRIX Image Tools
- ORKESTRIX Company Manager App
- ORKESTRIX Archive Studio

## Non-goals (explicit)

- Do NOT infer that every ORKESTRIX product must be desktop software.
- Do NOT infer that every ORKESTRIX product must be named "... System".
- Do NOT infer that ORKESTRIX only exists as a "System" family.
- Do NOT assign product-type descriptors not listed above.

## Current path position

```
SOURCE AUDIT            → complete (Docs/00–12, baseline 98bfc4a)
DOCUMENTATION BASELINE  → complete (Docs/13–13c V1 plan)
COMMERCIAL BRAND ARCH.  → this document (Docs/14)
V1 IMPLEMENTATION PLAN  → defined (P1–P12, Docs/13c order)
P1 TEST FOUNDATION      → next (not started)
P2 MIGRATION LEDGER     → pending
P3 I18N / SETTINGS / ERROR CODES → pending
P4 LOCALIZATION         → pending
P5 AUTH                 → pending
P6–P12                  → pending
COMMERCIAL VALIDATION   → pending
```

The V1 plan (Docs/13–13c) executes on the OpenProperty codebase and delivers the ORKESTRIX
Property System. Docs/13/13b/13c remain authoritative for execution order — this document does
not change the plan.