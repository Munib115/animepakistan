import * as cheerio from 'cheerio';

export interface StreamSource {
  label: string;
  url: string;
  isMultiAudio: boolean;
}

// In-Memory Stream Cache (30 Min TTL)
const streamCache = new Map<string, { sources: StreamSource[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 mins

// Normalize any dead/legacy CDN domains (e.g. as-cdn21.top -> as-cdn26.top)
export function sanitizeStreamUrl(url: string): string {
  if (!url) return '';
  return url
    .replace(/^http:\/\//i, 'https://')
    .replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top')
    .replace(/as-cdn(?!26)\d+\.top/gi, 'as-cdn26.top');
}

export async function resolveStreamSources(targetUrl: string): Promise<StreamSource[]> {
  if (!targetUrl) return [];

  const cleanTarget = targetUrl.replace(/^http:\/\//i, 'https://');

  // Check cache first for instant loading
  const cached = streamCache.get(cleanTarget);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.sources.length > 0) {
    return cached.sources.map(s => ({ ...s, url: sanitizeStreamUrl(s.url) }));
  }

  const sources: StreamSource[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s resilient timeout

    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.link/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      next: { revalidate: 1800 } // Cache at Next.js fetch layer for 30 mins
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

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

      // 1. Check for primary video servers
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

      // 2. Check for server buttons / player options / data-embed attributes
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
    }
  } catch (err: any) {
    console.warn(`[Resolver] Network fetch slow or timed out for ${targetUrl}, using active CDN fallback`);
  }

  // Fast Deterministic CDN Fallback if scraping timed out
  if (sources.length === 0) {
    const slugMatch = cleanTarget.match(/episode\/([^\/]+)/i) || cleanTarget.match(/movies\/([^\/]+)/i);
    const slug = slugMatch ? slugMatch[1] : '';
    if (slug) {
      sources.push({
        label: 'Server 1',
        url: `https://as-cdn26.top/video/${slug}/`,
        isMultiAudio: true,
      });
    }
  }

  // Cache resolved streams in memory
  if (sources.length > 0) {
    streamCache.set(cleanTarget, { sources, timestamp: Date.now() });
  }

  return sources;
}
