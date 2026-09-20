-- P4 — Algeria-shaped property address.
-- Additive only: existing rows keep NULL for all three new columns (state/zip
-- untouched), and the demo seed never writes them.

ALTER TABLE properties ADD COLUMN country TEXT;
ALTER TABLE properties ADD COLUMN wilaya TEXT;
ALTER TABLE properties ADD COLUMN commune TEXT;