import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { sanitizeStreamUrl, StreamSource } from '@/lib/resolver';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ sources: [] }, { status: 400 });
  }

  const cleanTarget = targetUrl.replace(/^http:\/\//i, 'https://');
  const sources: StreamSource[] = [];

  const isBadUrl = (u: string) => {
    const lower = u.toLowerCase();
    return (
      !lower ||
      lower.startsWith('about:blank') ||
      lower.includes('google') ||
      lower.includes('doubleclick') ||
      lower.includes('facebook') ||
      lower.includes('cloudflare') ||
      lower.includes('disqus') ||
      lower.includes('syndication') ||
      lower.includes('analytics')
    );
  };

  const parseHtmlForSources = (html: string) => {
    const $ = cheerio.load(html);

    // 1. Check iframes
    $('iframe').each((i, el) => {
      const rawSrc = $(el).attr('src') || $(el).attr('data-src') || '';
      if (rawSrc) {
        let fullSrc = rawSrc.startsWith('//') ? 'https:' + rawSrc : (rawSrc.startsWith('/') ? 'https://animesalt.link' + rawSrc : rawSrc);
        fullSrc = sanitizeStreamUrl(fullSrc);

        if (!isBadUrl(fullSrc) && !sources.some(s => s.url === fullSrc)) {
          sources.push({
            label: `Server ${sources.length + 1}`,
            url: fullSrc,
            isMultiAudio: true
          });
        }
      }
    });

    // 2. Check data-player / data-embed / data-src
    $('[data-player], [data-embed], .playex, [class*="server-btn"]').each((i, el) => {
      const rawEmbed = $(el).attr('data-embed') || $(el).attr('data-player') || $(el).attr('data-src') || '';
      if (rawEmbed && !rawEmbed.endsWith('.jpg') && !rawEmbed.endsWith('.png') && !rawEmbed.endsWith('.webp')) {
        let fullEmbed = rawEmbed.startsWith('//') ? 'https:' + rawEmbed : (rawEmbed.startsWith('/') ? 'https://animesalt.link' + rawEmbed : rawEmbed);
        fullEmbed = sanitizeStreamUrl(fullEmbed);

        if (!isBadUrl(fullEmbed) && !sources.some(s => s.url === fullEmbed)) {
          sources.push({
            label: `Server ${sources.length + 1}`,
            url: fullEmbed,
            isMultiAudio: false
          });
        }
      }
    });
  };

  try {
    // Attempt 1: Direct fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.link/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      cache: 'no-store'
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      parseHtmlForSources(html);
    }
  } catch (e: any) {
    console.warn('[Stream Resolve API] Direct fetch error:', e.message);
  }

  return NextResponse.json(
    { sources },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400',
      },
    }
  );
}
