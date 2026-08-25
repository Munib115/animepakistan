import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { AnimeItem } from '@/types/anime';
import { sanitizeStreamUrl } from './resolver';

const DB_FILE = path.join(process.cwd(), 'src', 'data', 'anime-db.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

let lastSyncTimestamp = 0;
const SYNC_COOLDOWN_MS = 1000 * 60 * 30; // 30 minutes cooldown between automated checks

function isBadUrl(u: string): boolean {
  const lower = u.toLowerCase();
  return (
    !lower ||
    lower.startsWith('about:blank') ||
    lower.includes('googletagmanager') ||
    lower.includes('doubleclick') ||
    lower.includes('facebook') ||
    lower.includes('analytics')
  );
}

async function fetchTMDBArt(query: string, type: string) {
  try {
    const encoded = encodeURIComponent(query.replace(/\(.*\)/g, '').replace(/\[.*\]/g, '').trim());
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encoded}`;
    const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encoded}`;

    const [tvRes, movRes] = await Promise.all([
      fetch(tvUrl).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(movUrl).then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    const all = [...(tvRes.results || []), ...(movRes.results || [])].filter(x => x && x.poster_path);
    if (all.length > 0) {
      all.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      const best = all[0];
      return {
        poster: `https://image.tmdb.org/t/p/w500${best.poster_path}`,
        backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : '',
        overview: best.overview || '',
        rating: best.vote_average ? Math.round(best.vote_average * 10) : null
      };
    }
  } catch (e) {}
  return null;
}

export async function checkAndSyncNewAnime(force = false): Promise<{ synced: number; total: number }> {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_COOLDOWN_MS) {
    return { synced: 0, total: 0 };
  }
  lastSyncTimestamp = now;

  console.log('[Sync Engine] Checking for new anime updates from AnimeSalt sitemaps...');

  let existing: AnimeItem[] = [];
  try {
    if (fs.existsSync(DB_FILE)) {
      existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Sync Engine] Error reading database:', e);
  }

  const existingMap = new Set(existing.map(i => i.slug.toLowerCase().trim()));

  const sitemaps = [
    { url: 'https://animesalt.cx/movies-sitemap1.xml', type: 'movie' },
    { url: 'https://animesalt.cx/movies-sitemap2.xml', type: 'movie' },
    { url: 'https://animesalt.cx/series-sitemap1.xml', type: 'series' },
    { url: 'https://animesalt.cx/series-sitemap2.xml', type: 'series' },
    { url: 'https://animesalt.cx/series-sitemap3.xml', type: 'series' }
  ];

  const newEntries: { url: string; type: 'movie' | 'series' }[] = [];

  for (const sm of sitemaps) {
    try {
      const res = await fetch(sm.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 1800 }
      });
      if (res.ok) {
        const xml = await res.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        $('url loc, loc').each((_, el) => {
          const loc = $(el).text().trim();
          if (loc) {
            const slug = loc.split('/').filter(Boolean).pop()?.toLowerCase().trim();
            if (slug && !existingMap.has(slug) && slug !== 'movies' && slug !== 'series') {
              newEntries.push({ url: loc, type: sm.type as 'movie' | 'series' });
              existingMap.add(slug);
            }
          }
        });
      }
    } catch (err) {
      console.warn(`[Sync Engine] Could not fetch sitemap ${sm.url}`);
    }
  }

  if (newEntries.length === 0) {
    console.log('[Sync Engine] Database is fully up-to-date with latest AnimeSalt catalog.');
    return { synced: 0, total: existing.length };
  }

  console.log(`[Sync Engine] Found ${newEntries.length} new anime items to sync!`);
  let addedCount = 0;

  for (const entry of newEntries) {
    try {
      const pageRes = await fetch(entry.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!pageRes.ok) continue;

      const html = await pageRes.text();
      const $ = cheerio.load(html);

      const title = $('h1.entry-title').text().trim() || $('h1').first().text().trim() || entry.url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || '';
      const slug = entry.url.split('/').filter(Boolean).pop() || '';

      const tmdbArt = await fetchTMDBArt(title, entry.type);

      let poster = tmdbArt?.poster || '';
      if (!poster) {
        const pagePoster = $('.bd img[data-src*="image.tmdb.org"]').first().attr('data-src') ||
                           $('.bd img[src*="image.tmdb.org"]').first().attr('src') || '';
        if (pagePoster) {
          poster = pagePoster.startsWith('//') ? 'https:' + pagePoster : pagePoster;
        }
      }

      let backdrop = tmdbArt?.backdrop || '';
      if (!backdrop) {
        const pageBackdrop = $('.TPostBg').first().attr('data-src') || $('.TPostBg').first().attr('src') || '';
        if (pageBackdrop) {
          backdrop = pageBackdrop.startsWith('//') ? 'https:' + pageBackdrop : pageBackdrop;
        }
      }

      const genres: string[] = [];
      $('a[href*="/genre/"], a[href*="/category/genre/"]').each((_, el) => {
        const g = $(el).text().trim();
        if (g && !genres.includes(g)) genres.push(g);
      });

      const audioLanguages: string[] = [];
      $('a[href*="/language/"], a[href*="/category/language/"]').each((_, el) => {
        const lang = $(el).text().trim();
        if (lang && !audioLanguages.includes(lang)) audioLanguages.push(lang);
      });

      const episodes: any[] = [];
      if (entry.type === 'series') {
        $('article.episodes').each((i, el) => {
          const epHref = $(el).find('a.lnk-blk').first().attr('href') || '';
          const epNum = $(el).find('.num-epi').text().trim();
          let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
          epTitle = epTitle.replace(/^private:\s*/gi, '');
          const epSlug = epHref.split('/').filter(Boolean).pop() || '';
          if (epSlug) {
            episodes.push({
              number: parseInt(epNum, 10) || i + 1,
              title: epTitle,
              slug: epSlug,
              url: epHref
            });
          }
        });
        episodes.sort((a, b) => a.number - b.number);
      }

      let streamUrl = '';
      if (entry.type === 'movie') {
        $('iframe').each((_, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src') || '';
          if (src && !isBadUrl(src)) {
            streamUrl = sanitizeStreamUrl(src);
            return false; // Break
          }
        });
      }

      const newItem: AnimeItem = {
        title,
        slug,
        url: entry.url.replace(/^http:\/\//i, 'https://'),
        type: entry.type,
        poster: poster || '',
        backdrop: backdrop || '',
        description: tmdbArt?.overview || $('.entry-content p').first().text().trim() || '',
        genres: genres.length > 0 ? genres : ['Action', 'Adventure'],
        audioLanguages: audioLanguages.length > 0 ? audioLanguages : ['Hindi', 'Urdu', 'Japanese'],
        episodes: entry.type === 'series' ? episodes : undefined,
        streamUrl: entry.type === 'movie' ? streamUrl : undefined,
        anilist: null
      };

      existing.unshift(newItem); // Place new anime at the top of catalog
      addedCount++;
      console.log(`  -> [Sync Engine] Added new anime: "${title}" (${entry.type})`);
    } catch (e: any) {
      console.error(`  -> [Sync Engine] Failed to scrape ${entry.url}:`, e.message);
    }
  }

  if (addedCount > 0) {
    fs.writeFileSync(DB_FILE, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`[Sync Engine] Successfully saved ${addedCount} new anime to database! Total: ${existing.length}`);
  }

  return { synced: addedCount, total: existing.length };
}
