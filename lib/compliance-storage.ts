import type { createClient } from "@/lib/supabase/client";

type SupabaseBrowserClient = ReturnType<typeof createClient>;

export const COMPLIANCE_BUCKET = "compliance-documents";

// 5-minute TTL. Long enough for a user to open the new tab and start the
// download even on slow connections, short enough that a leaked URL isn't a
// durable problem. Bump this only if you have a real reason — RLS already
// protects the underlying object; this is a defence-in-depth window.
export const SIGNED_URL_TTL_SECONDS = 300;

// Collapse anything outside [a-z0-9.\-] to "_" so storage paths stay
// predictable across operating systems. Lower-cases for the same reason —
// macOS storage is case-insensitive, Linux isn't.
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  // Edge case: a name like "===" sanitizes to "" — fall back to a stub so we
  // still have something to upload under.
  return cleaned || "file";
}

// Bucket-relative path: scope/{ms}-{sanitized_name}. The timestamp prefix
// keeps two uploads of the same filename from colliding even within the
// same scope folder.
export function buildStoragePath(scope: string, originalName: string): string {
  return `${scope}/${Date.now()}-${sanitizeFilename(originalName)}`;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// Best-effort filename for display. Paths look like
// "client/1717246813000-my_doc.pdf"; everything after the first dash in the
// last segment is the original (sanitized) filename.
export function displayNameFromFileUrl(fileUrl: string): string {
  if (isHttpUrl(fileUrl)) return fileUrl;
  const last = fileUrl.split("/").pop() ?? fileUrl;
  const dashIdx = last.indexOf("-");
  if (dashIdx === -1) return last;
  return last.slice(dashIdx + 1);
}

export async function uploadComplianceFile(
  supabase: SupabaseBrowserClient,
  scope: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const path = buildStoragePath(scope, file.name);
  const { error } = await supabase.storage
    .from(COMPLIANCE_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function deleteComplianceFile(
  supabase: SupabaseBrowserClient,
  path: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage
    .from(COMPLIANCE_BUCKET)
    .remove([path]);
  if (error) return { error: error.message };
  return { error: null };
}

// Open the doc's file in a new tab. http(s) URLs (legacy manually-entered)
// open directly; everything else is treated as a bucket-relative storage
// path and mints a short-lived signed URL first.
export async function openComplianceFile(
  supabase: SupabaseBrowserClient,
  fileUrl: string,
): Promise<{ error: string | null }> {
  if (isHttpUrl(fileUrl)) {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    return { error: null };
  }
  const { data, error } = await supabase.storage
    .from(COMPLIANCE_BUCKET)
    .createSignedUrl(fileUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    return { error: error?.message ?? "Failed to sign URL" };
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  return { error: null };
}
