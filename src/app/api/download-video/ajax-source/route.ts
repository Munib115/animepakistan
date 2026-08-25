import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');
  const referer = searchParams.get('referer') || 'https://animesalt.cx/';

  if (!hash) {
    return NextResponse.json({ error: 'Missing hash parameter' }, { status: 400 });
  }

  try {
    const url = `https://as-cdn26.top/player/index.php?data=${hash}&do=getVideo`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': 'https://as-cdn26.top',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: `hash=${hash}&r=${encodeURIComponent(referer)}`
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Backend returned status ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Failed to resolve AJAX source:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
