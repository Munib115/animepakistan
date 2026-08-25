import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamSources } from '@/lib/resolver-server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const saltSlug = searchParams.get('slug')?.trim();
  const epNumStr = searchParams.get('ep');
  const seasonStr = searchParams.get('season');
  const epNum = epNumStr ? parseInt(epNumStr, 10) : undefined;
  const epSeason = seasonStr ? parseInt(seasonStr, 10) : undefined;

  if (!saltSlug) {
    return NextResponse.json({ error: 'Missing slug parameter', sources: [] }, { status: 400 });
  }

  try {
    let cleanTarget = '';
    if (epNum === undefined || isNaN(epNum)) {
      cleanTarget = `https://animesalt.cx/movies/${saltSlug}/`;
    } else {
      cleanTarget = `https://animesalt.cx/series/${saltSlug}/`;
    }

    // Pass season so resolver picks the correct season's episode (fixes wrong-ep bug)
    const sources = await resolveStreamSources(cleanTarget, epNum, epSeason);

    return NextResponse.json(
      { sources, slug: saltSlug, ep: epNum, season: epSeason },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message, sources: [] }, { status: 500 });
  }
}
