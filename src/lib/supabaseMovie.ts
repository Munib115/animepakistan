import { supabase } from './supabase';

export const SUPABASE_MOVIES_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_MOVIES_BUCKET || 'movies';
export const DORAEMON_MOVIE_FILE_NAME = 'doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4';

/**
 * Returns the public direct streaming URL from Supabase Storage.
 * Supabase Storage natively supports HTTP Range 206 Partial Content headers for smooth mobile and desktop playback.
 */
export function getSupabaseMoviePublicUrl(
  fileName: string = DORAEMON_MOVIE_FILE_NAME,
  bucket: string = SUPABASE_MOVIES_BUCKET
): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data?.publicUrl || '';
}

/**
 * Creates a temporary signed streaming URL if the bucket is private.
 */
export async function getSupabaseMovieSignedUrl(
  fileName: string = DORAEMON_MOVIE_FILE_NAME,
  expiresInSeconds: number = 86400,
  bucket: string = SUPABASE_MOVIES_BUCKET
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(fileName, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('[SupabaseMovie] Failed to create signed URL:', error);
    return null;
  }
  return data.signedUrl;
}
