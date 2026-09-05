import * as cheerio from 'cheerio';
import { StreamSource, sanitizeStreamUrl, isValidStreamEmbedUrl } from './resolver';
import { getAnimeDb } from './db';

// In-Memory Stream Cache (24 Hour TTL for ultra-fast instant playback on return visits)
const streamCache = new Map<string, { sources: StreamSource[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** Check if a URL is an ad/tracker/garbage or full-website URL */
function isBadUrl(u: string): boolean {
  return !isValidStreamEmbedUrl(u);
}

/** Resolves direct HLS m3u8 source from as-cdn26.top via its internal getVideo API */
export async function resolveAsCdnDirectStream(embedUrl: string): Promise<string | null> {
  if (!embedUrl) return null;
  const hashMatch = embedUrl.match(/\/video\/([a-f0-9]+)/i);
  if (!hashMatch) return null;
  const hash = hashMatch[1];
  try {
    const body = new URLSearchParams();
    body.append('hash', hash);
    body.append('r', 'https://animesalt.cx/');
    const res = await fetch(`https://as-cdn26.top/player/index.php?data=${hash}&do=getVideo`, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://as-cdn26.top/video/${hash}`,
        'Origin': 'https://as-cdn26.top',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body.toString(),
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      return data.videoSource || data.securedLink || null;
    }
  } catch (e) {}
  return null;
}

function parseStreamUrlToSources(streamUrl: string): StreamSource[] {
  if (!streamUrl || !isValidStreamEmbedUrl(streamUrl)) return [];

  // Reject dead shorteners immediately
  if (streamUrl.includes('short.icu') || streamUrl.includes('short.link')) return [];

  if (streamUrl.includes('multi-lang-plyr/player.php?data=')) {
    try {
      const urlObj = new URL(streamUrl);
      const dataParam = urlObj.searchParams.get('data');
      if (dataParam) {
        const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
        const parsed = JSON.parse(decodedStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed
            .filter((item: any) => item.link && isValidStreamEmbedUrl(item.link))
            .map((item: any) => ({
              label: `Server (${item.language || 'HD'})`,
              url: sanitizeStreamUrl(item.link),
              isMultiAudio: false,
            }));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {}
    // If multi-lang-plyr only had dead links, do NOT return it!
    return [];
  }

  return [{ label: 'HD-1 (Hindi)', url: sanitizeStreamUrl(streamUrl), isMultiAudio: true }];
}

/**
 * Resolve stream sources with zero latency when pre-cached, and fast scraping fallback.
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

  const db = getAnimeDb();

  // 1. Direct match for episode URL (e.g. /episode/slug-1x1/)
  if (cleanTarget.includes('/episode/')) {
    const epSlugMatch = cleanTarget.match(/\/episode\/([^/]+)/);
    const epSlug = epSlugMatch ? epSlugMatch[1] : '';
    if (epSlug) {
      for (const anime of db) {
        if (!anime.episodes) continue;
        const foundEp = anime.episodes.find(e => e.slug === epSlug || (e.url && e.url.includes(epSlug)));
        if (foundEp && (foundEp as any).streamUrl) {
          const parsedSources = parseStreamUrlToSources((foundEp as any).streamUrl);
          if (parsedSources.length > 0) {
            for (const s of parsedSources) {
              if (s.url.includes('as-cdn') && !s.directApiStream) {
                try {
                  const direct = await resolveAsCdnDirectStream(s.url);
                  if (direct) s.directApiStream = direct;
                } catch (e) {}
              }
            }
            return parsedSources;
          }
        }
      }
    }
  }

  // 2. Direct match for movies
  if (cleanTarget.includes('/movies/')) {
    const movieSlugMatch = cleanTarget.match(/\/movies\/([^/]+)/);
    const movieSlug = movieSlugMatch ? movieSlugMatch[1] : '';
    if (movieSlug) {
      const anime = db.find(a => (a.saltSlug === movieSlug || a.slug === movieSlug) && a.type === 'movie');
      if (anime && anime.streamUrl) {
        const parsedSources = parseStreamUrlToSources(anime.streamUrl);
        if (parsedSources.length > 0) {
          for (const s of parsedSources) {
            if (s.url.includes('as-cdn') && !s.directApiStream) {
              try {
                const direct = await resolveAsCdnDirectStream(s.url);
                if (direct) s.directApiStream = direct;
              } catch (e) {}
            }
          }
          return parsedSources;
        }
      }
    }
  }

  // 3. Match for series/tv URL with episodeNumber
  const isSeries = cleanTarget.includes('/series/') || cleanTarget.includes('/tv/');
  if (isSeries) {
    const match = cleanTarget.match(/\/(series|tv)\/([^/]+)/);
    const slug = match ? match[2] : cleanTarget.replace(/^.*\/(series|tv)\//, '').split('/')[0];
    
    if (slug) {
      const anime = db.find(a => (a.saltSlug === slug || a.slug === slug) && a.type === 'series');
      const epNum = episodeNumber || 1;
      const epSeason = seasonNumber;

      // Match by season+number when season is provided, otherwise fall back to number-only
      const episode = anime?.episodes?.find(e => {
        if (!e.number) return false;
        const numMatch = e.number === epNum;
        if (!numMatch) return false;
        if (epSeason !== undefined) {
          const eSeason = e.season ?? (() => {
            const m = e.slug.match(/(\d+)x\d+/i);
            return m ? parseInt(m[1], 10) : 1;
          })();
          return eSeason === epSeason;
        }
        return true;
      });

      // If episode has a pre-cached streamUrl, parse and return instantly!
      if (episode && (episode as any).streamUrl) {
        const parsedSources = parseStreamUrlToSources((episode as any).streamUrl);
        if (parsedSources.length > 0) {
          for (const s of parsedSources) {
            if (s.url.includes('as-cdn') && !s.directApiStream) {
              try {
                const direct = await resolveAsCdnDirectStream(s.url);
                if (direct) s.directApiStream = direct;
              } catch (e) {}
            }
          }
          return parsedSources;
        }
      }

      if (episode && episode.url && episode.url.startsWith('http')) {
        cleanTarget = episode.url.replace(/animesalt\.(link|me)/gi, 'animesalt.cx');
      } else {
        const eSeason = episode?.season ?? epSeason ?? 1;
        cleanTarget = `https://animesalt.cx/episode/${slug}-${eSeason}x${epNum}/`;
      }
    }
  }

  const cacheKey = cleanTarget;

  // Check in-memory stream cache
  const cached = streamCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.sources.length > 0) {
    return cached.sources;
  }

  const sources: StreamSource[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout for reliable serverless fetches

    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.cx/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Extract server button labels if available (e.g. SERVER 1 (SUB), SERVER 2 (DUB))
      const serverLabels: string[] = [];
      $('.server-btn').each((_, el) => {
        const name = $(el).find('.server-name').text().trim();
        const info = $(el).find('.server-info').text().trim();
        if (name) {
          serverLabels.push(info ? `${name} (${info.toUpperCase()})` : name);
        }
      });

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
            let label = serverLabels[sources.length] || `Server ${sources.length + 1}`;
            if (fullSrc.includes('/sub') && !label.toUpperCase().includes('SUB')) {
              label += ' (Sub)';
            } else if (fullSrc.includes('/dub') && !label.toUpperCase().includes('DUB')) {
              label += ' (Dub)';
            }
            sources.push({
              label,
              url: sanitizeStreamUrl(fullSrc),
              isMultiAudio: true
            });
          }
        }
      });

      // Additional fallback for embed data attributes
      if (sources.length === 0) {
        $('[data-player], [data-embed], .playex').each((_, el) => {
          const embed = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-src');
          if (embed && embed.startsWith('http') && !isBadUrl(embed)) {
            const clean = sanitizeStreamUrl(embed);
            if (!sources.some(s => s.url === clean)) {
              sources.push({
                label: `Server ${sources.length + 1}`,
                url: clean,
                isMultiAudio: true
              });
            }
          }
        });
      }
    }
  } catch (err: any) {
    console.warn(`[Resolver Server] Note: ${cleanTarget} resolution notice:`, err?.message);
  }

  // Filter out any source that is not a valid stream embed (strictly reject third-party website pages and dead shorteners)
  const validSources = sources.filter(s => s.url && isValidStreamEmbedUrl(s.url));

  // Sort as-cdn sources first
  validSources.sort((a, b) => {
    const aIsCdn = a.url.includes('as-cdn') ? -1 : 1;
    const bIsCdn = b.url.includes('as-cdn') ? -1 : 1;
    return aIsCdn - bIsCdn;
  });

  // Attach direct API stream for primary as-cdn source
  for (const s of validSources) {
    if (s.url.includes('as-cdn') && !s.directApiStream) {
      try {
        const direct = await resolveAsCdnDirectStream(s.url);
        if (direct) s.directApiStream = direct;
      } catch (e) {}
      break;
    }
  }

  // Cache results for 24h
  if (validSources.length > 0) {
    streamCache.set(cacheKey, { sources: validSources, timestamp: Date.now() });
  }

  return validSources;
}
