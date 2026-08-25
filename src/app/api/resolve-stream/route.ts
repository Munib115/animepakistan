import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamSources } from '@/lib/resolver-server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');
  const epParam = searchParams.get('ep');
  const epNumber = epParam ? parseInt(epParam, 10) : undefined;

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target url' }, { status: 400 });
  }

  try {
    const sources = await resolveStreamSources(
      decodeURIComponent(targetUrl),
      epNumber && !isNaN(epNumber) ? epNumber : undefined
    );
    return NextResponse.json({ sources }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, sources: [] }, { status: 500 });
  }
}

