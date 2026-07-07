-- ============================================
-- WIDEN lighting_temperature
-- ============================================
-- environment_snapshots.lighting_temperature was defined as numeric(5,2)
-- (max magnitude 999.99), but the /environment manual-entry form labels
-- this field "Lighting Temp (K)" - real color temperatures run
-- 2000-6500K+, which don't fit. scripts/seed-demo.mjs hit this as
-- "numeric field overflow" when seeding realistic Kelvin values.
-- Widening (not shrinking the semantic to a 0-100 scale) because Kelvin
-- is the unit the UI already commits to.

alter table environment_snapshots
    alter column lighting_temperature type numeric(6,1);
