-- 0010_detachments_and_photos.sql
-- Client → Detachments → Guards restructure, per-detachment org charts,
-- guard photos, license-expiry surfacing.
--
-- NOTE: this repo has no automated migration runner. Apply via the Supabase
-- SQL editor (or psql against the project DB). Idempotent — safe to re-run.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT pid FROM pg_stat_activity WHERE state='idle in transaction' AND pid<>pg_backend_pid()
  LOOP PERFORM pg_terminate_backend(r.pid); END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS detachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  is_single_post boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, name)
);
CREATE INDEX IF NOT EXISTS idx_detachments_client ON detachments(client_id);

ALTER TABLE guards
  ADD COLUMN IF NOT EXISTS detachment_id uuid REFERENCES detachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_url text;
CREATE INDEX IF NOT EXISTS idx_guards_detachment ON guards(detachment_id);

ALTER TABLE org_nodes
  ADD COLUMN IF NOT EXISTS detachment_id uuid REFERENCES detachments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_detached boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_x float,
  ADD COLUMN IF NOT EXISTS pos_y float;
ALTER TABLE org_nodes ALTER COLUMN client_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_nodes_detachment ON org_nodes(detachment_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('guard-photos','guard-photos',false,5242880)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE detachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all ON detachments;
CREATE POLICY authenticated_all ON detachments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "guard_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "guard_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "guard_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "guard_photos_delete" ON storage.objects;
CREATE POLICY "guard_photos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='guard-photos');
CREATE POLICY "guard_photos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='guard-photos');
CREATE POLICY "guard_photos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='guard-photos') WITH CHECK (bucket_id='guard-photos');
CREATE POLICY "guard_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='guard-photos');
