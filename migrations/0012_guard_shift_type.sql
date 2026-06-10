-- 0012_guard_shift_type.sql
-- Move shift designation from positions (org_nodes.shift) to guards
-- (guards.shift_type). Idempotent — safe to re-run. Legacy columns
-- (guards.is_reliever, org_nodes.shift) are kept dormant for transition.

ALTER TABLE guards ADD COLUMN IF NOT EXISTS shift_type text;
-- shift_type values: 'day', 'night', 'reliever', or null (unspecified)

-- Backfill: existing relievers get shift_type='reliever'
UPDATE guards SET shift_type = 'reliever' WHERE is_reliever = true AND shift_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_guards_shift_type ON guards(shift_type) WHERE shift_type IS NOT NULL;

SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='guards' AND column_name='shift_type') AS col,
  (SELECT COUNT(*) FROM guards WHERE shift_type='reliever') AS relievers_migrated;
-- Expected: col=1, relievers_migrated >= 0
