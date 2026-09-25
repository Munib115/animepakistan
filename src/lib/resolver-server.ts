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

/** Resolves direct HLS m3u8 source (disabled: as-cdn26.top is down with Error 522) */
export async function resolveAsCdnDirectStream(embedUrl: string): Promise<string | null> {
  return null;
}

/** Resolves direct HLS m3u8 source from megaplay.buzz */
export async function resolveMegaplayDirectStream(streamUrl: string): Promise<string | null> {
  if (!streamUrl || !streamUrl.includes('megaplay.buzz')) return null;
  try {
    const res = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://animesalt.cx/'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const fileIdMatch = html.match(/File\s+(\d+)/i);
    if (!fileIdMatch) return null;
    const fileId = fileIdMatch[1];
    const apiRes = await fetch(`https://megaplay.buzz/stream/getSources?id=${fileId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': streamUrl,
        'X-Requested-With': 'XMLHttpRequest'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      return data?.sources?.file || null;
    }
  } catch (e) {}
  return null;
}

/** Resolves nested ad-heavy toon-stream embed to direct clean iframe player */
export async function resolveToonStreamNested(embedUrl: string): Promise<string | null> {
  if (!embedUrl || !embedUrl.includes('toon-stream.site/embed/')) return null;
  try {
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://toon-stream.site/'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      let src = $('iframe').attr('src') || $('iframe').attr('data-src');
      if (src?.startsWith('//')) src = 'https:' + src;
      if (src && isValidStreamEmbedUrl(src)) {
        return sanitizeStreamUrl(src);
      }
    }
  } catch (e) {}
  return null;
}

function parseStreamUrlToSources(streamUrl: string): StreamSource[] {
  if (!streamUrl || !isValidStreamEmbedUrl(streamUrl)) return [];

  // Reject dead shorteners and dead as-cdn top-level player (throws Cloudflare Error 522)
  if (streamUrl.includes('short.icu') || streamUrl.includes('short.link') || (streamUrl.includes('as-cdn') && streamUrl.includes('.top'))) return [];

  // Dedicated MegaPlay handler for Sub and Dub (Boruto, etc.)
  if (streamUrl.includes('megaplay.buzz/stream/')) {
    const subUrl = streamUrl.replace(/\/dub$/i, '/sub');
    const dubUrl = streamUrl.replace(/\/sub$/i, '/dub');
    return [
      { label: 'MegaPlay (Sub)', url: sanitizeStreamUrl(subUrl), isMultiAudio: true },
      { label: 'MegaPlay (Dub)', url: sanitizeStreamUrl(dubUrl), isMultiAudio: true },
    ];
  }

  // Clean unnested direct player mirrors
  if (streamUrl.includes('gdmirrorbot') || streamUrl.includes('abyssplayer')) {
    return [{ label: 'Server 1 (HD)', url: sanitizeStreamUrl(streamUrl), isMultiAudio: true }];
  }

  if (streamUrl.includes('multi-lang-plyr') && streamUrl.includes('data=')) {
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
              label: `AnimeSalt (${item.language || 'HD'})`,
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

/** Enriches stream sources by un-nesting embedded players and fetching high-speed direct API streams */
async function enrichSourcesWithDirectStreams(sourcesList: StreamSource[]) {
  for (let i = 0; i < sourcesList.length; i++) {
    const s = sourcesList[i];
    // Un-nest any toon-stream nested embeds
    if (s.url.includes('toon-stream.site/embed/')) {
      try {
        const unnested = await resolveToonStreamNested(s.url);
        if (unnested) s.url = unnested;
      } catch (e) {}
    }
    // Attach direct as-cdn HLS stream if available
    if (s.url.includes('as-cdn') && !s.directApiStream) {
      try {
        const direct = await resolveAsCdnDirectStream(s.url);
        if (direct) s.directApiStream = direct;
      } catch (e) {}
    }
    // Attach direct megaplay master HLS stream if available
    if (s.url.includes('megaplay.buzz') && !s.directApiStream) {
      try {
        const direct = await resolveMegaplayDirectStream(s.url);
        if (direct) s.directApiStream = direct;
      } catch (e) {}
    }
  }
}

/**
 * Dedicated movie stream resolver:
 * 1. Checks pre-cached streamSources on anime object
 * 2. Checks toonStreamUrl on anime object
 * 3. Dynamically resolves from ToonStream (direct candidate URLs and live search)
 * 4. Only offers AnimeSalt as a secondary fallback if ToonStream has no stream
 */
export async function resolveMovieStreamSources(anime: any): Promise<StreamSource[]> {
  if (!anime) return [];

  // 1. If pre-cached streamSources exists and has active toonstream sources
  if (anime.streamSources && anime.streamSources.length > 0) {
    const valid = anime.streamSources.filter((s: any) => isValidStreamEmbedUrl(s.url));
    const hasToon = valid.some((s: any) => s.label?.includes('ToonStream') || !s.label?.includes('AnimeSalt'));
    if (hasToon) {
      return valid.sort((a: any, b: any) => {
        const aIsSalt = a.label?.includes('AnimeSalt') ? 1 : -1;
        const bIsSalt = b.label?.includes('AnimeSalt') ? 1 : -1;
        return aIsSalt - bIsSalt;
      });
    }
  }

  // 2. If toonStreamUrl is present
  if (anime.toonStreamUrl && isValidStreamEmbedUrl(anime.toonStreamUrl)) {
    const sources: StreamSource[] = [
      { label: 'ToonStream 1 (HD)', url: sanitizeStreamUrl(anime.toonStreamUrl), isMultiAudio: true }
    ];
    if (anime.saltStreamUrl && isValidStreamEmbedUrl(anime.saltStreamUrl)) {
      sources.push({ label: 'AnimeSalt (Backup)', url: sanitizeStreamUrl(anime.saltStreamUrl), isMultiAudio: true });
    }
    return sources;
  }

  // 3. Dynamic fetch from ToonStream candidate URLs
  const candidateUrls: string[] = [];
  if (anime.toonUrl) candidateUrls.push(anime.toonUrl);
  if (anime.toonSlug) candidateUrls.push(`https://toonstream.us/movies/${anime.toonSlug}/`);
  const cleanTitleSlug = (anime.title || '').toLowerCase().replace(/['":!?()&]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  candidateUrls.push(`https://toonstream.us/movies/${cleanTitleSlug}/`);
  candidateUrls.push(`https://toonstream.us/movies/${anime.slug}/`);
  if (anime.saltSlug) candidateUrls.push(`https://toonstream.us/movies/${anime.saltSlug}/`);

  for (const url of [...new Set(candidateUrls)]) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Referer': 'https://toonstream.us/',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const html = await res.text();
        if (html.length > 5000) {
          const $ = cheerio.load(html);
          const streams: string[] = [];
          $('iframe').each((_, el) => {
            let s = $(el).attr('src') || $(el).attr('data-src') || '';
            if (s.startsWith('//')) s = 'https:' + s;
            if (isValidStreamEmbedUrl(s) && !streams.includes(s)) streams.push(s);
          });
          const active = streams.filter(s => !s.includes('youtube'));
          if (active.length > 0) {
            const resultSources: StreamSource[] = active.map((s, i) => ({
              label: i === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${i + 1} (Mirror)`,
              url: sanitizeStreamUrl(s),
              isMultiAudio: true,
            }));
            if (anime.saltStreamUrl || anime.streamUrl) {
              const salt = anime.saltStreamUrl || anime.streamUrl;
              if (isValidStreamEmbedUrl(salt)) {
                resultSources.push({ label: 'AnimeSalt (Backup)', url: sanitizeStreamUrl(salt), isMultiAudio: true });
              }
            }
            anime.toonStreamUrl = active[0];
            anime.streamSources = resultSources;
            anime.toonUrl = url;
            return resultSources;
          }
        }
      }
    } catch (e) {}
  }

  // 4. Try searching ToonStream via live API and search page
  try {
    const cleanTitle = (anime.title || '')
      .replace(/^(Movie|Series|Watch|Free)\s*[:\-]?\s*/gi, '')
      .replace(/\s*\((Hindi|Urdu|Dubbed|Season|Sub|Dual Audio|English|\d{4})[^)]*\)/gi, '')
      .replace(/Hindi Dubbed|Urdu Dubbed|Dual Audio/gi, '')
      .trim();

    let movieLink: string | null = null;

    // A. Query search/all API
    try {
      const apiRes = await fetch(`https://toonstream.us/search/all?q=${encodeURIComponent(cleanTitle)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://toonstream.us/home',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (apiRes.ok) {
        const json = await apiRes.json();
        const movieItem = (json.data || []).find((x: any) => x.type === 'movie' || x.url?.includes('/movies/'));
        if (movieItem?.url) {
          movieLink = movieItem.url;
        }
      }
    } catch (e) {}

    // B. Fallback to /s?q=... search page
    if (!movieLink) {
      const searchUrl = `https://toonstream.us/s?q=${encodeURIComponent(cleanTitle)}&type=movie`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://toonstream.us/home',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (searchRes.ok) {
        const searchHtml = await searchRes.text();
        const $ = cheerio.load(searchHtml);
        movieLink = $('a[href*="/movies/"]').first().attr('href') || null;
      }
    }

    if (movieLink) {
      const fullLink = movieLink.startsWith('http') ? movieLink : `https://toonstream.us${movieLink}`;
      const pageRes = await fetch(fullLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://toonstream.us/',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (pageRes.ok) {
        const pageHtml = await pageRes.text();
        const $$ = cheerio.load(pageHtml);
        const streams: string[] = [];
        $$('iframe').each((_, el) => {
          let s = $$(el).attr('src') || $$(el).attr('data-src') || '';
          if (s.startsWith('//')) s = 'https:' + s;
          if (isValidStreamEmbedUrl(s) && !streams.includes(s)) streams.push(s);
        });
        $$('[data-player], [data-embed], .playex, [data-url]').each((_, el) => {
          let s = $$(el).attr('data-player') || $$(el).attr('data-embed') || $$(el).attr('data-url') || $$(el).attr('data-src') || '';
          if (s.startsWith('//')) s = 'https:' + s;
          if (isValidStreamEmbedUrl(s) && !streams.includes(s)) streams.push(s);
        });

        // Rank fast reliable mirrors first
        const priorityOrder = (url: string) => {
          const l = url.toLowerCase();
          if (l.includes('filesforever.link')) return 1;
          if (l.includes('abyssplayer.com')) return 2;
          if (l.includes('cloudy.upns.one')) return 3;
          if (l.includes('vidstreaming.xyz')) return 4;
          if (l.includes('vidmoly.net')) return 5;
          if (l.includes('emturbovid.com')) return 6;
          if (l.includes('byselapuix.com')) return 7;
          if (l.includes('streamsb.net')) return 8;
          if (l.includes('rubystm.com')) return 9;
          return 10;
        };

        const active = streams
          .filter(s => isValidStreamEmbedUrl(s))
          .sort((a, b) => priorityOrder(a) - priorityOrder(b));

        if (active.length > 0) {
          const resultSources: StreamSource[] = active.map((s, i) => ({
            label: i === 0 ? 'ToonStream 1 (HD)' : i === 1 ? 'ToonStream 2 (Fast)' : `ToonStream ${i + 1} (Mirror)`,
            url: sanitizeStreamUrl(s),
            isMultiAudio: true,
          }));
          anime.toonStreamUrl = active[0];
          anime.streamSources = resultSources;
          anime.toonUrl = fullLink;
          return resultSources;
        }
      }
    }
  } catch (e) {}

  // 5. Fallback if AnimeSalt had a stream and nothing else was found
  if (anime.saltStreamUrl || anime.streamUrl) {
    const saltUrl = anime.saltStreamUrl || anime.streamUrl;
    if (isValidStreamEmbedUrl(saltUrl)) {
      return [{
        label: 'AnimeSalt (Backup)',
        url: sanitizeStreamUrl(saltUrl),
        isMultiAudio: true,
      }];
    }
  }

  return [];
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
        const foundEp = anime.episodes.find(e =>
          e.slug === epSlug ||
          (e as any).toonSlug === epSlug ||
          (e.url && e.url.includes(epSlug)) ||
          ((e as any).toonUrl && (e as any).toonUrl.includes(epSlug))
        );
        if (foundEp) {
          if ((foundEp as any).streamSources && (foundEp as any).streamSources.length > 0) {
            const valid = (foundEp as any).streamSources.filter((s: any) => isValidStreamEmbedUrl(s.url));
            if (valid.length > 0) return valid;
          }
          if ((foundEp as any).toonStreamUrl || (foundEp as any).streamUrl) {
            const streamToParse = (foundEp as any).toonStreamUrl || (foundEp as any).streamUrl;
            const parsedSources = parseStreamUrlToSources(streamToParse);
            if (parsedSources.length > 0) {
              await enrichSourcesWithDirectStreams(parsedSources);
              return parsedSources;
            }
          }
          if ((foundEp as any).url && (foundEp as any).url.includes('animesalt')) {
            cleanTarget = (foundEp as any).url;
          } else if ((foundEp as any).toonUrl) {
            cleanTarget = (foundEp as any).toonUrl;
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
      const anime = db.find(a =>
        (a.saltSlug === movieSlug || a.slug === movieSlug || (a as any).toonSlug === movieSlug) &&
        a.type === 'movie'
      );
      if (anime) {
        const movieSources = await resolveMovieStreamSources(anime);
        if (movieSources.length > 0) return movieSources;
      }
    }
  }

  // 3. Match for series/tv URL with episodeNumber
  const isSeries = cleanTarget.includes('/series/') || cleanTarget.includes('/tv/');
  if (isSeries) {
    const match = cleanTarget.match(/\/(series|tv)\/([^/]+)/);
    const slug = match ? match[2] : cleanTarget.replace(/^.*\/(series|tv)\//, '').split('/')[0];
    
    if (slug) {
      const anime = db.find(a =>
        (a.saltSlug === slug || a.slug === slug || (a as any).toonSlug === slug) &&
        a.type === 'series'
      );
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

      if (episode) {
        if ((episode as any).streamSources && (episode as any).streamSources.length > 0) {
          const valid = (episode as any).streamSources.filter((s: any) => isValidStreamEmbedUrl(s.url));
          if (valid.length > 0) return valid;
        }
        if ((episode as any).toonStreamUrl || (episode as any).streamUrl) {
          const streamToParse = (episode as any).toonStreamUrl || (episode as any).streamUrl;
          const parsedSources = parseStreamUrlToSources(streamToParse);
          if (parsedSources.length > 0) {
            await enrichSourcesWithDirectStreams(parsedSources);
            return parsedSources;
          }
        }
        if ((episode as any).toonUrl) {
          cleanTarget = (episode as any).toonUrl;
        } else if (episode.url && episode.url.startsWith('http')) {
          cleanTarget = episode.url;
        }
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

    const isToonStream = cleanTarget.includes('toonstream.us');
    const res = await fetch(cleanTarget, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': isToonStream ? 'https://toonstream.us/' : 'https://animesalt.cx/',
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
          
          if (fullSrc.includes('multi-lang-plyr') && fullSrc.includes('data=')) {
            try {
              const urlObj = new URL(fullSrc);
              const dataParam = urlObj.searchParams.get('data');
              if (dataParam) {
                const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
                const parsed = JSON.parse(decodedStr);
                if (Array.isArray(parsed)) {
                  for (const item of parsed) {
                    if (item.link && isValidStreamEmbedUrl(item.link)) {
                      sources.push({
                        label: `AnimeSalt (${item.language || 'HD'})`,
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

  // Prioritize active working ToonStream servers, keep AnimeSalt as secondary backup
  validSources.forEach(s => {
    if (s.url.includes('animesalt') || s.label.includes('AnimeSalt')) {
      s.label = s.label.includes('(') ? s.label : 'AnimeSalt (Backup)';
    }
  });

  // Sort: ToonStream servers come first!
  validSources.sort((a, b) => {
    const aIsSalt = (a.label.includes('AnimeSalt') || a.url.includes('animesalt')) ? 1 : -1;
    const bIsSalt = (b.label.includes('AnimeSalt') || b.url.includes('animesalt')) ? 1 : -1;
    return aIsSalt - bIsSalt;
  });

  // Attach direct API stream and un-nest any players
  await enrichSourcesWithDirectStreams(validSources);

  // Cache results for 24h
  if (validSources.length > 0) {
    streamCache.set(cacheKey, { sources: validSources, timestamp: Date.now() });
  }

  return validSources;
}
