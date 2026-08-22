import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamSources } from '@/lib/resolver';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target url' }, { status: 400 });
  }

  try {
    const sources = await resolveStreamSources(decodeURIComponent(targetUrl));
    return NextResponse.json({ sources }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, sources: [] }, { status: 500 });
  }
}
