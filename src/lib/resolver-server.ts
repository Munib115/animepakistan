import * as cheerio from 'cheerio';
import { StreamSource, sanitizeStreamUrl } from './resolver';
import { getAnimeDb } from './db';

// In-Memory Stream Cache (30 Min TTL)
const streamCache = new Map<string, { sources: StreamSource[]; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 mins

/** Check if a URL is an ad/tracker/garbage URL */
function isBadUrl(u: string): boolean {
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
    lower.includes('analytics') ||
    lower.includes('googletagmanager') ||
    lower.includes('youtube.com/embed')
  );
}

/**
 * Resolve stream sources from animesalt.cx by fetching the page.
 * 
 * @param targetUrl - The animesalt.cx URL (movies or episode page)
 * @param episodeNumber - Optional episode number to filter
 */
export async function resolveStreamSources(
  targetUrl: string,
  episodeNumber?: number,
  seasonNumber?: number
): Promise<StreamSource[]> {
  if (!targetUrl) return [];

  // Normalize URL to animesalt.cx format
  let cleanTarget = targetUrl
    .replace(/^http:\/\//i, 'https://')
    .replace(/animesalt\.(link|me)/gi, 'animesalt.cx');

  // If series/tv page and episode number is specified, find/construct correct episode page URL
  const isSeries = cleanTarget.includes('/series/') || cleanTarget.includes('/tv/');
  if (isSeries) {
    const match = cleanTarget.match(/animesalt\.cx\/(series|tv)\/([^/]+)/);
    const slug = match ? match[2] : cleanTarget.replace(/^.*\/(series|tv)\//, '').split('/')[0];
    
    if (slug) {
      const db = getAnimeDb();
      const anime = db.find(a => (a.saltSlug === slug || a.slug === slug) && a.type === 'series');
      const epNum = episodeNumber || 1;
      const epSeason = seasonNumber; // may be undefined for single-season lookup

      // Match by season+number when season is provided, otherwise fall back to number-only
      const episode = anime?.episodes?.find(e => {
        if (!e.number) return false;
        const numMatch = e.number === epNum;
        if (!numMatch) return false;
        if (epSeason !== undefined) {
          // Derive season from episode season field or slug pattern (e.g. "show-2x3" → season 2)
          const eSeason = e.season ?? (() => {
            const m = e.slug.match(/(\d+)x\d+/i);
            return m ? parseInt(m[1], 10) : 1;
          })();
          return eSeason === epSeason;
        }
        return true; // no season filter → first number match (single-season)
      });

      if (episode && episode.url && episode.url.startsWith('http')) {
        cleanTarget = episode.url.replace(/animesalt\.(link|me)/gi, 'animesalt.cx');
      } else {
        // Build correct episode URL using season derived from match or default to 1
        const eSeason = episode?.season ?? epSeason ?? 1;
        cleanTarget = `https://animesalt.cx/episode/${slug}-${eSeason}x${epNum}/`;
      }
    }
  }

  const cacheKey = cleanTarget;

  // Check cache
  const cached = streamCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.sources.length > 0) {
    return cached.sources;
  }

  const sources: StreamSource[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.cx/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      next: { revalidate: 1800 },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Parse all iframes on the page
      $('iframe').each((_, el) => {
        const rawSrc = $(el).attr('src') || $(el).attr('data-src') || '';
        if (rawSrc) {
          let fullSrc = rawSrc.startsWith('//') ? 'https:' + rawSrc : rawSrc;
          
          if (fullSrc.includes('multi-lang-plyr/player.php?data=')) {
            try {
              const urlObj = new URL(fullSrc);
              const dataParam = urlObj.searchParams.get('data');
              if (dataParam) {
                const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
                const parsed = JSON.parse(decodedStr);
                if (Array.isArray(parsed)) {
                  for (const item of parsed) {
                    if (item.link) {
                      sources.push({
                        label: `Abyss (${item.language || 'HD'})`,
                        url: sanitizeStreamUrl(item.link),
                        isMultiAudio: false
                      });
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Failed to parse multi-lang player data:', e);
            }
          } else if (!isBadUrl(fullSrc)) {
            sources.push({
              label: `Server ${sources.length + 1}`,
              url: sanitizeStreamUrl(fullSrc),
              isMultiAudio: true
            });
          }
        }
      });
    }
  } catch (err: any) {
    console.warn(`[Resolver Server] Timed out or failed for: ${cleanTarget}`, err?.message);
  }

  // Cache results
  if (sources.length > 0) {
    streamCache.set(cacheKey, { sources, timestamp: Date.now() });
  }

  return sources;
}
