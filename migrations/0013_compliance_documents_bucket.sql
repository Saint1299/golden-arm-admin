-- 0013_compliance_documents_bucket.sql
-- Create the compliance-documents storage bucket.
--
-- The four compliance_docs_* RLS policies on storage.objects were applied
-- earlier, but the bucket itself was never created — so every upload failed
-- with "Bucket not found". The policies start working the moment the bucket
-- exists.
--
-- NOTE: this repo has no automated migration runner. Apply via the Supabase
-- SQL editor (or psql against the project DB). Idempotent — safe to re-run.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('compliance-documents', 'compliance-documents', false, 10485760) -- 10MB
ON CONFLICT (id) DO NOTHING;

-- 10MB is more generous than guard-photos' 5MB because compliance docs
-- (scanned LTOPF licenses, multi-page government forms, etc.) can exceed 5MB.

-- Verification
SELECT
  (SELECT COUNT(*) FROM storage.buckets WHERE id='compliance-documents') AS bucket_exists,
  (SELECT file_size_limit FROM storage.buckets WHERE id='compliance-documents') AS size_limit,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'compliance_docs_%') AS policy_count;
-- Expected: bucket_exists=1, size_limit=10485760, policy_count=4
