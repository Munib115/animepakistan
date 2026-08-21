import { NextRequest, NextResponse } from 'next/server';
import { getAnimeDb } from '@/lib/db';

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';

  if (query.length < 2) {
    return NextResponse.json([]);
  }

  const results = getAnimeDb()
    .filter((anime) => {
      const searchable = [
        anime.title,
        anime.anilist?.englishName,
        anime.anilist?.romajiName,
        ...(anime.genres || []),
        ...(anime.anilist?.genres || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    })
    .slice(0, 8)
    .map((anime) => ({
      slug: anime.slug,
      type: anime.type,
      title: anime.anilist?.englishName || anime.anilist?.romajiName || anime.title,
      poster: anime.poster || anime.anilist?.coverImage || '',
      audioLanguages: anime.audioLanguages || [],
    }));

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
  });
}
