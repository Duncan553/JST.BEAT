import { supabaseAdmin } from '@/lib/supabase-admin';
import { UPLOAD_RULES, UploadKind } from '@/lib/upload-kinds';

// After a direct-to-Storage upload the client tells us "here's the path".
// We do not take its word for it: this confirms the object really exists, sits
// in the folder that kind is allowed to use, and matches the type/size rules.
// Without this, the client controls what gets written into the DB row.
export async function verifyUploaded(kind: UploadKind, path: string) {
  const rule = UPLOAD_RULES[kind];

  // Path was minted by /api/uploads/sign as `<folder>/<ts>-<uuid>-<name>`.
  // Anything else means the client made it up.
  if (!path || !path.startsWith(`${rule.folder}/`) || path.includes('..')) {
    throw new Error(`Invalid upload path for ${kind}`);
  }

  const { data, error } = await supabaseAdmin.storage.from(rule.bucket).info(path);
  if (error || !data) throw new Error(`Upload for ${kind} was not found in storage — please retry.`);

  const size = Number((data as any).size ?? 0);
  const type = String((data as any).contentType || (data as any).metadata?.mimetype || '').toLowerCase().split(';')[0];

  if (size <= 0) throw new Error(`Uploaded ${kind} is empty.`);
  if (size > rule.maxBytes) throw new Error(`Uploaded ${kind} is too large (${(size / 1048576).toFixed(1)}MB).`);
  if (type && !rule.mimes.includes(type)) throw new Error(`Uploaded ${kind} has the wrong type: ${type}`);

  return { bucket: rule.bucket, path, size, type };
}

/** Public URL for an object we've already verified. */
export function publicUrl(bucket: string, path: string): string {
  return supabaseAdmin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Deletes objects left behind by a failed finalize, but ONLY if no row points
 * at them. The old rollback deleted blindly; with paths now arriving in the
 * request body, a blind delete is a way to wipe a live beat's files.
 */
export async function rollbackOrphans(files: Array<{ bucket: string; path: string }>) {
  // Every table+column that can point at a stored file. A rollback must never
  // delete something a live row still needs — with paths now arriving in the
  // request body instead of the bytes themselves, a blind delete would be a
  // way to wipe a published beat's files.
  const REFERENCES: Array<[string, string[]]> = [
    ['beats', ['full_url', 'snippet_url', 'cover_art', 'stems_url']],
    ['tracks', ['full_url', 'snippet_url']],
    ['releases', ['cover_art']],
    ['posts', ['cover_art']],
    ['producers', ['photo_url']],
  ];

  for (const { bucket, path } of files) {
    const url = publicUrl(bucket, path);

    const hits = await Promise.all(
      REFERENCES.map(([table, cols]) =>
        supabaseAdmin.from(table).select('id').or(cols.map((c) => `${c}.eq.${url}`).join(',')).limit(1)
      )
    );
    // A query that errors (table missing, column renamed) counts as "might be
    // referenced" — refusing to delete is always the safer failure here.
    if (hits.some((h) => h.error || (h.data && h.data.length > 0))) {
      console.warn(`[rollback] Skipped ${bucket}/${path} — still referenced, or the check failed.`);
      continue;
    }

    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
    if (error) console.error(`[rollback] Could not remove ${bucket}/${path}:`, error.message);
  }
}
