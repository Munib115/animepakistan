import { NextRequest, NextResponse } from 'next/server';

function unpackDeanEdwards(packedScript: string): string | null {
  try {
    const idx = packedScript.indexOf('eval(function(p,a,c,k,e,d)');
    if (idx === -1) return null;

    let scriptBlock = packedScript.slice(idx);
    const endIdx = scriptBlock.indexOf('</script>');
    if (endIdx !== -1) scriptBlock = scriptBlock.slice(0, endIdx);

    // Strip leading eval
    const executable = scriptBlock.replace(/^eval\s*/, '');
    // Execute the unpacking function safely
    const unpacked = (new Function(`return ${executable}`))();
    return typeof unpacked === 'string' ? unpacked : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ success: false, error: 'Missing url parameter' }, { status: 400 });
  }

  // 1. RubySTM / StreamRuby direct stream extraction
  if (targetUrl.includes('rubystm.com') || targetUrl.includes('streamruby.com')) {
    try {
      const urlObj = new URL(targetUrl);
      const pathname = urlObj.pathname.replace('.html', '');
      const fileCode = pathname.split('/').pop()?.split('-').pop();

      if (!fileCode) {
        return NextResponse.json({ success: false, fallbackUrl: targetUrl });
      }

      const form = new URLSearchParams();
      form.append('op', 'embed');
      form.append('file_code', fileCode);
      form.append('auto', '1');
      form.append('referer', 'https://toonstream.us/');

      const res = await fetch('https://rubystm.com/dl', {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': targetUrl,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        return NextResponse.json({ success: false, fallbackUrl: targetUrl });
      }

      const html = await res.text();
      const unpacked = unpackDeanEdwards(html);

      if (unpacked) {
        const m3u8Matches = unpacked.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>?]*(?:\?[^\s"'<>]*)?/g);
        if (m3u8Matches && m3u8Matches.length > 0) {
          const directStreamUrl = m3u8Matches[0];
          return NextResponse.json({
            success: true,
            streamUrl: directStreamUrl,
            type: 'hls',
            provider: 'rubystm',
            fallbackUrl: targetUrl,
          }, {
            headers: {
              'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            }
          });
        }
      }
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e.message, fallbackUrl: targetUrl });
    }
  }

  // Fallback for other providers
  return NextResponse.json({ success: false, fallbackUrl: targetUrl });
}
