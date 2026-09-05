import { NextRequest, NextResponse } from 'next/server';
import { getAnimeCatalog } from '@/lib/db';

export function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() || '';

  if (rawQuery.length < 2) {
    return NextResponse.json([]);
  }

  // Support phonetic aliases e.g. benten / ben ten -> ben 10
  const normalizedQuery = rawQuery
    .replace(/\bbenten\b/gi, 'ben 10')
    .replace(/\bben\s+ten\b/gi, 'ben 10');

  const results = getAnimeCatalog()
    .filter((anime) => {
      const searchable = [
        anime.title,
        anime.anilist?.englishName,
        anime.anilist?.romajiName,
        ...(anime.genres || []),
        ...(anime.anilist?.genres || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(rawQuery) || searchable.includes(normalizedQuery);
    })
    .sort((a, b) => {
      const aStarts = a.title.toLowerCase().startsWith(normalizedQuery);
      const bStarts = b.title.toLowerCase().startsWith(normalizedQuery);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      if (a.type === 'series' && b.type !== 'series') return -1;
      if (a.type !== 'series' && b.type === 'series') return 1;
      return 0;
    })
    .slice(0, 14)
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
