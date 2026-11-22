/**
 * Tournament notices in the tournament_notices storage bucket.
 */
import { supabase } from "@/lib/supabase";

export const NOTICES_BUCKET = "tournament_notices";

export async function listTournamentNotices(folder: string): Promise<any[]> {
  const { data, error } = await supabase.storage.from(NOTICES_BUCKET).list(folder, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) throw error;
  return (data || []).filter((f) => f.name !== ".emptyFolderPlaceholder");
}

export async function uploadTournamentNotice(folder: string, fileName: string, file: File): Promise<void> {
  const { error } = await supabase.storage.from(NOTICES_BUCKET).upload(`${folder}/${fileName}`, file);
  if (error) throw error;
}

export async function deleteTournamentNotice(folder: string, fileName: string): Promise<void> {
  const { error } = await supabase.storage.from(NOTICES_BUCKET).remove([`${folder}/${fileName}`]);
  if (error) throw error;
}

export function getTournamentNoticePublicUrl(folder: string, fileName: string): string {
  return supabase.storage.from(NOTICES_BUCKET).getPublicUrl(`${folder}/${fileName}`).data.publicUrl;
}

/** Uploads `file` as `fileName` at the root of the notices bucket and returns its public URL. */
export async function uploadNoticeFile(fileName: string, file: File): Promise<string> {
  const { error } = await supabase.storage
    .from(NOTICES_BUCKET)
    .upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage
    .from(NOTICES_BUCKET)
    .getPublicUrl(fileName);
  return data.publicUrl;
}
