import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { AnimeItem, Episode, StreamMirrorSource } from '@/types/anime';
import { sanitizeStreamUrl, isValidStreamEmbedUrl } from './resolver';

const DB_FILE = path.join(process.cwd(), 'src', 'data', 'anime-db.json');
const CATALOG_FILE = path.join(process.cwd(), 'src', 'data', 'anime-catalog.json');

let lastSyncTimestamp = 0;
const SYNC_COOLDOWN_MS = 1000 * 60 * 15; // 15 minutes cooldown

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://toonstream.us/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function extractStreamsFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const streams: string[] = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStreamEmbedUrl(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

function buildStreamSources(streams: string[]): StreamMirrorSource[] {
  const active = streams.filter(s => !s.includes('as-cdn') && !s.includes('youtube'));
  const salt = streams.filter(s => s.includes('as-cdn'));
  const sources: StreamMirrorSource[] = [];
  salt.forEach((s, idx) => {
    sources.push({
      label: idx === 0 ? 'AnimeSalt (HD)' : `AnimeSalt Mirror ${idx + 1}`,
      url: sanitizeStreamUrl(s),
      isMultiAudio: true,
    });
  });
  active.forEach((s, idx) => {
    sources.push({
      label: idx === 0 ? 'ToonStream 1 (Mirror)' : `ToonStream ${idx + 1} (Mirror)`,
      url: sanitizeStreamUrl(s),
      isMultiAudio: true,
    });
  });
  return sources;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function saveCatalog(db: AnimeItem[]) {
  const catalog = db.map(item => ({
    id: (item as any).id || `ap-${item.slug}`,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || undefined,
    toonSlug: (item as any).toonSlug || undefined,
    type: item.type,
    poster: item.poster,
    backdrop: item.backdrop || item.poster,
    rating: (item as any).rating || 8.0,
    year: (item as any).year || 2024,
    genres: item.genres || ['Anime'],
    audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
    episodeCount: item.type === 'series' ? (item.episodes ? item.episodes.length : (item.episodeCount || 0)) : undefined,
    episodesCount: item.type === 'series' ? (item.episodes ? item.episodes.length : (item.episodesCount || 0)) : undefined,
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || (item as any).toonStreamUrl)
      : (item.episodes ? item.episodes.some((e: any) => !!(e.streamUrl || e.toonStreamUrl)) : false),
  }));
  try {
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2), 'utf8');
  } catch (e) {
    console.error('[Sync Engine] Error writing catalog:', e);
  }
}

export async function checkAndSyncNewAnime(force = false): Promise<{ synced: number; total: number }> {
  const now = Date.now();
  if (!force && now - lastSyncTimestamp < SYNC_COOLDOWN_MS) {
    return { synced: 0, total: 0 };
  }
  lastSyncTimestamp = now;

  console.log('[Sync Engine] Auto-syncing from ToonStream for fresh drops, series, and movies...');

  let db: AnimeItem[] = [];
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Sync Engine] Error reading database:', e);
    return { synced: 0, total: 0 };
  }

  let totalUpdated = 0;

  // 1. Sync Fresh Drops / Newly added episodes from ToonStream home
  try {
    const homeHtml = await fetchHtml('https://toonstream.us/home');
    if (homeHtml) {
      const $ = cheerio.load(homeHtml);
      const freshEpUrls: string[] = [];
      $('a[href*="/episode/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const full = href.startsWith('http') ? href : `https://toonstream.us${href}`;
        if (!freshEpUrls.includes(full)) freshEpUrls.push(full);
      });

      for (const epUrl of freshEpUrls.slice(0, 25)) {
        const match = epUrl.match(/\/episode\/(.+?)-(\d+)x(\d+)\/?$/i);
        if (!match) continue;

        const seriesSlug = match[1];
        const season = parseInt(match[2], 10);
        const num = parseInt(match[3], 10);

        const series = db.find(d =>
          d.type === 'series' && (
            d.slug === seriesSlug ||
            (d as any).toonSlug === seriesSlug ||
            d.slug.includes(seriesSlug) ||
            seriesSlug.includes(d.slug)
          )
        );

        if (!series) continue;
        if (!series.episodes) series.episodes = [];

        let ep = series.episodes.find(e => e.season === season && e.number === num);

        if (!ep) {
          const epHtml = await fetchHtml(epUrl);
          if (!epHtml) continue;
          const streams = extractStreamsFromHtml(epHtml);
          const active = streams.filter(s => !s.includes('as-cdn') && !s.includes('youtube'));
          if (active.length === 0) continue;

          ep = {
            number: num,
            season,
            title: `S${season} E${num}: Episode ${num}`,
            slug: `${series.slug}-${season}x${num}`,
            url: epUrl,
            thumbnail: series.poster || '',
            streamUrl: active[0],
            toonStreamUrl: active[0],
            streamSources: buildStreamSources(streams),
          };
          series.episodes.push(ep);
          series.episodes.sort((a, b) => (a.season === b.season ? a.number - b.number : (a.season || 1) - (b.season || 1)));
          series.episodeCount = series.episodes.length;
          series.episodesCount = series.episodes.length;
          totalUpdated++;
          await delay(250);
        } else if (!(ep as any).toonStreamUrl) {
          const epHtml = await fetchHtml(epUrl);
          if (!epHtml) continue;
          const streams = extractStreamsFromHtml(epHtml);
          const active = streams.filter(s => !s.includes('as-cdn') && !s.includes('youtube'));
          if (active.length > 0) {
            (ep as any).toonStreamUrl = active[0];
            ep.streamUrl = active[0];
            (ep as any).streamSources = buildStreamSources(streams);
            totalUpdated++;
          }
          await delay(250);
        }
      }
    }
  } catch (e: any) {
    console.warn('[Sync Engine] Error syncing fresh episodes:', e.message);
  }

  // 2. Sync page 1 of movies from ToonStream
  try {
    const moviesHtml = await fetchHtml('https://toonstream.us/category/movies?type=all&page=1');
    if (moviesHtml) {
      const $ = cheerio.load(moviesHtml);
      const movieLinks: { title: string; url: string; slug: string }[] = [];
      $('article, .item').each((_, el) => {
        const href = $(el).find('a[href*="/movies/"]').first().attr('href') || '';
        if (!href) return;
        const slugMatch = href.match(/\/movies\/([^/?\s]+)/);
        if (!slugMatch) return;
        const title = $(el).find('h2, h3, .entry-title, .title').first().text().trim();
        const url = href.startsWith('http') ? href : `https://toonstream.us${href}`;
        movieLinks.push({ title, url, slug: slugMatch[1] });
      });

      for (const mItem of movieLinks.slice(0, 15)) {
        let movie = db.find(d =>
          d.type === 'movie' && (
            (d as any).toonSlug === mItem.slug ||
            d.slug === mItem.slug
          )
        );

        if (!movie) {
          const mHtml = await fetchHtml(mItem.url);
          if (!mHtml) continue;
          const streams = extractStreamsFromHtml(mHtml);
          const active = streams.filter(s => !s.includes('as-cdn') && !s.includes('youtube'));
          if (active.length > 0) {
            const newMovie: AnimeItem = {
              title: mItem.title,
              slug: mItem.slug,
              toonSlug: mItem.slug,
              toonUrl: mItem.url,
              url: mItem.url,
              type: 'movie',
              poster: '',
              description: `Watch ${mItem.title} full movie in Hindi, Urdu, English dub and sub on Anime Pakistan.`,
              genres: ['Anime', 'Movie'],
              audioLanguages: ['Hindi', 'Urdu', 'English'],
              streamUrl: active[0],
              toonStreamUrl: active[0],
              streamSources: buildStreamSources(streams),
            };
            db.unshift(newMovie);
            totalUpdated++;
          }
          await delay(250);
        } else if (!(movie as any).toonStreamUrl) {
          const mHtml = await fetchHtml(mItem.url);
          if (!mHtml) continue;
          const streams = extractStreamsFromHtml(mHtml);
          const active = streams.filter(s => !s.includes('as-cdn') && !s.includes('youtube'));
          if (active.length > 0) {
            (movie as any).toonSlug = mItem.slug;
            (movie as any).toonUrl = mItem.url;
            (movie as any).toonStreamUrl = active[0];
            movie.streamUrl = active[0];
            (movie as any).streamSources = buildStreamSources(streams);
            totalUpdated++;
          }
          await delay(250);
        }
      }
    }
  } catch (e: any) {
    console.warn('[Sync Engine] Error syncing movies:', e.message);
  }

  // Ensure all series have both episodeCount and episodesCount normalized
  db.forEach(item => {
    if (item.type === 'series') {
      const count = (item.episodes ? item.episodes.length : 0) || item.episodeCount || (item as any).episodesCount || 0;
      item.episodeCount = count;
      (item as any).episodesCount = count;
    }
  });

  if (totalUpdated > 0 || force) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    saveCatalog(db);
    console.log(`[Sync Engine] Saved ${totalUpdated} updates from ToonStream! Total items: ${db.length}`);
  }

  return { synced: totalUpdated, total: db.length };
}
