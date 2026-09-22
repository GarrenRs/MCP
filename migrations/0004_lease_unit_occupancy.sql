-- P9 — Lease & occupancy integrity.
-- Additive only: composite indexes so lease-then-status lookups (occupancy
-- reconciliation) and date-range overlap checks stay fast at portfolio scale.
-- No table shape changes, no column drops.

CREATE INDEX IF NOT EXISTS idx_leases_unit_status ON leases(unit_id, status);
CREATE INDEX IF NOT EXISTS idx_leases_unit_dates ON leases(unit_id, start_date, end_date);
