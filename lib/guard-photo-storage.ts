// Guard photo storage helpers. Mirrors lib/compliance-storage.ts but targets
// the private `guard-photos` bucket. Photos are stored as bucket-relative
// paths on guards.photo_url; display always goes through a short-lived signed
// URL (the bucket is private; RLS protects the underlying object).
import type { createClient as createBrowserClient } from "@/lib/supabase/client";

// Accepts either the browser or the server Supabase client — both expose the
// same `.storage` surface used here.
type SupabaseLike = ReturnType<typeof createBrowserClient>;

export const GUARD_PHOTOS_BUCKET = "guard-photos";

// 1-hour TTL. Photos are embedded in pages (chart canvases, detail headers)
// that a user may keep open for a while, so a short doc-download window would
// break the <img>. RLS still guards the object; this is the display window.
export const SIGNED_URL_TTL_SECONDS = 3600;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned || "photo";
}

// Bucket-relative path: {guardId}/{ms}-{sanitized_name}. Folder-per-guard
// keeps a guard's photos together and lets the RLS path conventions stay
// predictable.
export function buildStoragePath(guardId: string, originalName: string): string {
  return `${guardId}/${Date.now()}-${sanitizeFilename(originalName)}`;
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function uploadGuardPhoto(
  supabase: SupabaseLike,
  guardId: string,
  file: File,
): Promise<{ path: string | null; error: string | null }> {
  const path = buildStoragePath(guardId, file.name);
  const { error } = await supabase.storage
    .from(GUARD_PHOTOS_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

export async function deleteGuardPhoto(
  supabase: SupabaseLike,
  path: string,
): Promise<{ error: string | null }> {
  // Legacy http(s) URLs aren't ours to delete; no-op.
  if (isHttpUrl(path)) return { error: null };
  const { error } = await supabase.storage
    .from(GUARD_PHOTOS_BUCKET)
    .remove([path]);
  if (error) return { error: error.message };
  return { error: null };
}

// Single signed URL — used for previews in the form and the detail header.
export async function getGuardPhotoSignedUrl(
  supabase: SupabaseLike,
  pathOrUrl: string | null,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (isHttpUrl(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage
    .from(GUARD_PHOTOS_BUCKET)
    .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

// Batch signed URLs — used server-side for chart canvases / lists to avoid an
// N+1 of client-side createSignedUrl calls. Returns a map keyed by the input
// path. Legacy http(s) urls pass through unsigned.
export async function getGuardPhotoSignedUrlMap(
  supabase: SupabaseLike,
  paths: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const toSign: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    if (isHttpUrl(p)) {
      out[p] = p;
    } else if (!toSign.includes(p)) {
      toSign.push(p);
    }
  }
  if (toSign.length === 0) return out;
  const { data } = await supabase.storage
    .from(GUARD_PHOTOS_BUCKET)
    .createSignedUrls(toSign, SIGNED_URL_TTL_SECONDS);
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

// Open a guard's photo in a new tab (e.g. "view full size").
export async function openGuardPhoto(
  supabase: SupabaseLike,
  pathOrUrl: string,
): Promise<{ error: string | null }> {
  const url = await getGuardPhotoSignedUrl(supabase, pathOrUrl);
  if (!url) return { error: "Failed to sign photo URL" };
  window.open(url, "_blank", "noopener,noreferrer");
  return { error: null };
}
