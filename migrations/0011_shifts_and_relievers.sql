-- 0011_shifts_and_relievers.sql
-- Shift-aware org chart (org_nodes.shift) + standby relievers (guards.is_reliever).
-- Idempotent — safe to re-run. Apply via the Supabase SQL editor or psql.

ALTER TABLE org_nodes ADD COLUMN IF NOT EXISTS shift text;
-- shift values: 'day', 'night', or null (null = applies to all shifts / "any")

ALTER TABLE guards ADD COLUMN IF NOT EXISTS is_reliever boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_guards_reliever ON guards(is_reliever) WHERE is_reliever = true;

-- Verification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='org_nodes' AND column_name='shift') AS shift_col,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='guards' AND column_name='is_reliever') AS reliever_col;
-- Expected: 1, 1
