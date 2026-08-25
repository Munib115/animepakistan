import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chunkUrl = searchParams.get('url');

  if (!chunkUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const res = await fetch(chunkUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://as-cdn26.top/'
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch chunk (status ${res.status})` }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      headers: {
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err: any) {
    console.error('Failed to proxy video chunk:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
