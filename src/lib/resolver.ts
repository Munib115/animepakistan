import * as cheerio from 'cheerio';

export interface StreamSource {
  label: string;
  url: string;
  isMultiAudio: boolean;
}

// In-Memory Stream Cache (1 Hour TTL)
const streamCache = new Map<string, { sources: StreamSource[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 Hour

export async function resolveStreamSources(targetUrl: string): Promise<StreamSource[]> {
  if (!targetUrl) return [];

  const cleanTarget = targetUrl.replace(/^http:\/\//i, 'https://');

  // Check cache first for 0ms instant loading
  const cached = streamCache.get(cleanTarget);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.sources.length > 0) {
    return cached.sources;
  }

  const sources: StreamSource[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s fast timeout

    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.link/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      next: { revalidate: 3600 } // Cache at Next.js fetch layer for 1 hour
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
          lower.includes('short.icu') ||
          lower.includes('player.php') ||
          lower.includes('google') ||
          lower.includes('doubleclick') ||
          lower.includes('facebook') ||
          lower.includes('cloudflare') ||
          lower.includes('disqus') ||
          lower.includes('syndication') ||
          lower.includes('analytics')
        );
      };

      // 1. Check for primary high-speed CDN video servers (e.g. as-cdn21.top, as-cdn*.top)
      $('iframe').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src && (src.includes('as-cdn') || src.includes('.top/video') || src.includes('/video/'))) {
          const fullSrc = src.startsWith('//') ? 'https:' + src : (src.startsWith('/') ? 'https://animesalt.link' + src : src);
          if (!isBadUrl(fullSrc) && !sources.some(s => s.url === fullSrc)) {
            sources.push({
              label: 'Multi-Audio VIP HD',
              url: fullSrc,
              isMultiAudio: true
            });
          }
        }
      });

      // 2. Check for server buttons / dooplay player options / data-embed attributes
      $('[data-player], [data-embed], .playex, [class*="server-btn"]').each((i, el) => {
        const embed = $(el).attr('data-embed') || $(el).attr('data-player') || $(el).attr('data-src') || '';
        if (embed) {
          let fullEmbed = embed.startsWith('//') ? 'https:' + embed : (embed.startsWith('/') ? 'https://animesalt.link' + embed : embed);
          if (!isBadUrl(fullEmbed) && !sources.some(s => s.url === fullEmbed)) {
            sources.push({
              label: `HD Server ${sources.length + 1}`,
              url: fullEmbed,
              isMultiAudio: false
            });
          }
        }
      });

      // 3. Fallback to any generic valid video iframes
      $('iframe').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src) {
          let fullSrc = src.startsWith('//') ? 'https:' + src : (src.startsWith('/') ? 'https://animesalt.link' + src : src);
          if (!isBadUrl(fullSrc) && !sources.some(s => s.url === fullSrc)) {
            sources.push({
              label: `Mirror ${sources.length + 1}`,
              url: fullSrc,
              isMultiAudio: false
            });
          }
        }
      });
    }
  } catch (err: any) {
    console.warn(`[Resolver] Network fetch slow or timed out for ${targetUrl}, using fast CDN fallback`);
  }

  // Fast Deterministic CDN Fallback if scraping timed out
  if (sources.length === 0) {
    const slugMatch = cleanTarget.match(/episode\/([^\/]+)/i) || cleanTarget.match(/movies\/([^\/]+)/i);
    const slug = slugMatch ? slugMatch[1] : '';
    if (slug) {
      sources.push({
        label: 'Multi-Audio VIP HD',
        url: `https://as-cdn21.top/video/${slug}/`,
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
