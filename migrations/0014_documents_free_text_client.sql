-- 0014_documents_free_text_client.sql
-- Add the free-text client name + issuing agency columns to documents.
-- Replicates migration 0008, which was applied locally but never landed on
-- this production database — staff hit "Could not find the 'client_name_text'
-- column of 'documents' in the schema cache" on save.
--
-- Beyond adding the two columns, 0008 also (a) swapped the doc_scope_target
-- CHECK from client_id to client_name_text and (b) rebuilt the compliance_board
-- view to resolve client names from the free-text column instead of the
-- client_id FK. Both are replicated here, because the old client_id column
-- cannot be dropped while the constraint and view still reference it.
--
-- NOTE: this repo has no automated migration runner. Apply via the Supabase
-- SQL editor (or psql against the project DB). Idempotent — safe to re-run.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_name_text text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issuing_agency text;

-- Backfill client_name_text from the old client_id FK for any rows that still
-- reference it (none on this DB, but keep it faithful + idempotent).
UPDATE documents d
SET client_name_text = c.name
FROM clients c
WHERE d.client_id = c.id AND d.client_name_text IS NULL;

-- Rebuild the board view first so it no longer references documents.client_id,
-- otherwise the DROP COLUMN below fails ("view depends on column"). CREATE OR
-- REPLACE preserves the view's grants + ownership; the original column order is
-- kept intact with issuing_agency appended at the end (required by REPLACE).
CREATE OR REPLACE VIEW compliance_board AS
  SELECT
    d.id,
    d.scope,
    d.doc_type,
    d.doc_number,
    d.expiry_date,
    CASE
      WHEN d.expiry_date IS NULL THEN NULL::integer
      ELSE d.expiry_date - CURRENT_DATE
    END AS days_remaining,
    CASE
      WHEN d.expiry_date IS NULL THEN 'ok'::text
      WHEN d.expiry_date < CURRENT_DATE THEN 'expired'::text
      WHEN d.expiry_date <= (CURRENT_DATE + 30) THEN 'due_soon'::text
      ELSE 'ok'::text
    END AS alert_status,
    g.full_name AS guard_name,
    CASE
      WHEN d.scope = 'client'::document_scope THEN d.client_name_text
      WHEN d.scope = 'guard'::document_scope THEN gc.name
      ELSE NULL::text
    END AS client_name,
    d.issuing_agency
  FROM documents d
    LEFT JOIN guards g ON g.id = d.guard_id
    LEFT JOIN clients gc ON gc.id = g.client_id
  ORDER BY d.expiry_date;

-- The doc_scope_target CHECK references client_id, so swap it to
-- client_name_text BEFORE dropping the column. DROP + ADD keeps it re-runnable
-- (ADD CONSTRAINT has no IF NOT EXISTS).
ALTER TABLE documents DROP CONSTRAINT IF EXISTS doc_scope_target;

-- Drop the old client_id FK column since we use free text now.
ALTER TABLE documents DROP COLUMN IF EXISTS client_id;

ALTER TABLE documents ADD CONSTRAINT doc_scope_target CHECK (
  (scope = 'guard'::document_scope AND guard_id IS NOT NULL)
  OR (scope = 'client'::document_scope AND client_name_text IS NOT NULL)
  OR (scope = 'company'::document_scope)
);

-- Refresh PostgREST schema cache so the API picks up the new columns.
NOTIFY pgrst, 'reload schema';

-- Verification
SELECT
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='client_name_text') AS has_client_name_text,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='issuing_agency') AS has_issuing_agency,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='documents' AND column_name='client_id') AS still_has_client_id;
-- Expected: 1, 1, 0
