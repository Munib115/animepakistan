import * as cheerio from 'cheerio';

export interface StreamSource {
  label: string;
  url: string;
  isMultiAudio: boolean;
}

export async function resolveStreamSources(targetUrl: string): Promise<StreamSource[]> {
  const sources: StreamSource[] = [];

  if (!targetUrl) return sources;

  try {
    const cleanTarget = targetUrl.replace(/^http:\/\//i, 'https://');
    console.log(`[Resolver] Fetching stream sources for: ${cleanTarget}`);

    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.link/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      console.warn(`[Resolver] Failed to fetch page: ${res.status} for ${cleanTarget}`);
      return sources;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // List of blacklisted domains (ads, cloudflare challenge, dead shorteners)
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

  } catch (err: any) {
    console.error(`[Resolver] Error resolving streams for ${targetUrl}:`, err.message);
  }

  return sources;
}

