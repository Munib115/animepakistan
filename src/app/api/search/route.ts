import { NextRequest, NextResponse } from 'next/server';
import { getAnimeCatalog } from '@/lib/db';

const ALIAS_MAP: Record<string, string> = {
  'benten': 'ben 10',
  'ben ten': 'ben 10',
  'shin chan': 'shinchan',
  'shin-chan': 'shinchan',
  'doremon': 'doraemon',
  'doreamon': 'doraemon',
  'dbz': 'dragon ball z',
  'dragonball': 'dragon ball',
  'opm': 'one punch man',
  'aot': 'attack on titan',
  'snk': 'attack on titan',
  'shingeki': 'attack on titan',
  'jjk': 'jujutsu kaisen',
  'mha': 'my hero academia',
  'boku no hero': 'my hero academia',
  'kimetsu': 'demon slayer',
  'kny': 'demon slayer',
  'naruto shippuden': 'naruto',
  'boruto': 'boruto',
  'solo leveling': 'solo leveling',
  'spy family': 'spy x family',
  'konosuba': 'konosuba',
};

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[’'":;,.\-–—_!/?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET(request: NextRequest) {
  try {
    const rawQuery = request.nextUrl.searchParams.get('q')?.trim() || '';

    if (rawQuery.length < 2) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
      });
    }

    const lowerQuery = rawQuery.toLowerCase();
    const cleanQuery = normalizeString(rawQuery);

    // Check alias expansions
    let expandedQuery = cleanQuery;
    for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
      if (cleanQuery.includes(alias)) {
        expandedQuery = cleanQuery.replace(alias, canonical);
        break;
      }
    }

    const queryTokens = Array.from(new Set([...cleanQuery.split(' '), ...expandedQuery.split(' ')]))
      .filter((t) => t.length >= 2);

    const catalog = getAnimeCatalog() || [];

    const scored = catalog.map((anime) => {
      const titleClean = normalizeString(anime.title || '');
      const enClean = normalizeString(anime.anilist?.englishName || '');
      const romajiClean = normalizeString(anime.anilist?.romajiName || '');
      const genresClean = normalizeString((anime.genres || []).join(' '));
      const slugClean = normalizeString((anime.slug || '').replace(/-/g, ' '));
      const audioClean = normalizeString((anime.audioLanguages || []).join(' '));

      const fullSearchable = `${titleClean} ${enClean} ${romajiClean} ${genresClean} ${slugClean} ${audioClean}`;

      // Check if all tokens match or if query matches directly
      const directMatch =
        titleClean.includes(cleanQuery) ||
        enClean.includes(cleanQuery) ||
        romajiClean.includes(cleanQuery) ||
        slugClean.includes(cleanQuery) ||
        fullSearchable.includes(cleanQuery) ||
        fullSearchable.includes(expandedQuery);

      const tokenMatches = queryTokens.every((token) => fullSearchable.includes(token));

      if (!directMatch && !tokenMatches) {
        return { anime, score: 0 };
      }

      let score = 10;

      // Exact title match gets maximum boost
      if (titleClean === cleanQuery || enClean === cleanQuery) {
        score += 100;
      } else if (titleClean.startsWith(cleanQuery) || enClean.startsWith(cleanQuery)) {
        score += 60;
      } else if (titleClean.includes(cleanQuery) || enClean.includes(cleanQuery)) {
        score += 40;
      } else if (slugClean.startsWith(cleanQuery)) {
        score += 30;
      } else if (tokenMatches) {
        score += 20;
      }

      // Small tie-breakers: series preference, ratings
      if (anime.type === 'series') score += 5;
      if (anime.anilist?.rating) score += anime.anilist.rating / 10;

      return { anime, score };
    });

    const results = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 16)
      .map(({ anime }) => ({
        slug: anime.slug,
        type: anime.type,
        title: anime.anilist?.englishName || anime.anilist?.romajiName || anime.title,
        poster: anime.poster || anime.anilist?.coverImage || '',
        year: anime.anilist?.year || undefined,
        rating: anime.anilist?.rating ? (anime.anilist.rating / 10).toFixed(1) : null,
        audioLanguages: anime.audioLanguages || [],
        genres: (anime.genres || []).slice(0, 2),
      }));

    return NextResponse.json(results, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json([], {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
