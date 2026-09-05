import { NextRequest, NextResponse } from 'next/server';
import { resolveStreamSources } from '@/lib/resolver-server';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const targetUrl = searchParams.get('url');
  const epParam = searchParams.get('ep');
  const epNumber = epParam ? parseInt(epParam, 10) : undefined;

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing target url' }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(targetUrl);

  try {
    let sources = await resolveStreamSources(
      decodedUrl,
      epNumber && !isNaN(epNumber) ? epNumber : undefined
    );

    if (sources.length === 0 && decodedUrl.startsWith('http')) {
      sources = [{
        label: 'Direct Server (HD)',
        url: decodedUrl,
        isMultiAudio: true,
      }];
    }

    return NextResponse.json({ sources }, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      sources: decodedUrl.startsWith('http') ? [{ label: 'Direct Server (HD)', url: decodedUrl, isMultiAudio: true }] : [],
    });
  }
}

