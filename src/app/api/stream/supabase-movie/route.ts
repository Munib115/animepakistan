import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseMoviePublicUrl, DORAEMON_MOVIE_FILE_NAME, SUPABASE_MOVIES_BUCKET } from '@/lib/supabaseMovie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * High-performance streaming proxy and redirect for Supabase Storage movie files.
 * Supports mobile byte-range scrubbing and direct CDN redirection.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file') || DORAEMON_MOVIE_FILE_NAME;
  const bucket = searchParams.get('bucket') || SUPABASE_MOVIES_BUCKET;

  const publicUrl = getSupabaseMoviePublicUrl(file, bucket);

  if (!publicUrl) {
    return new NextResponse('Movie stream URL could not be resolved from Supabase', { status: 404 });
  }

  // Redirect directly to Supabase Storage CDN (which natively handles 206 Partial Content range requests)
  return NextResponse.redirect(publicUrl, {
    status: 307,
    headers: {
      'Cache-Control': 'public, max-age=86400, no-transform',
      'Accept-Ranges': 'bytes',
    },
  });
}
