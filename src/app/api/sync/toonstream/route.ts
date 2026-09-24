import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for Vercel

const DB_PATH = path.join(process.cwd(), 'src/data/anime-db.json');
const CATALOG_PATH = path.join(process.cwd(), 'src/data/anime-catalog.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://toonstream.us/',
};

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

function isValidStream(url: string): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  if (!l.startsWith('http')) return false;
  const BAD = ['themoviedb.org', 'youtube.com', 'google.', 'facebook.', 'about:blank',
    'short.icu', 'toonstream.us', 'animesalt.cx', 'wikipedia.'];
  return !BAD.some(b => l.includes(b));
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

function extractStreams(html: string): string[] {
  const $ = cheerio.load(html);
  const streams: string[] = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

function buildSources(streams: string[]) {
  const active = streams.filter(s => !s.includes('as-cdn') && !s.includes('animesalt'));
  const salt = streams.filter(s => !s.includes('as-cdn') && s.includes('animesalt'));
  const sources: any[] = [];
  active.forEach((s, i) => sources.push({ label: i === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${i + 1}`, url: s, isMultiAudio: true }));
  salt.forEach((s, i) => sources.push({ label: `AnimeSalt Mirror ${i + 1}`, url: s, isMultiAudio: true }));
  return sources;
}

function saveCatalog(db: any[]) {
  const catalog = db.map(item => ({
    id: item.id || `ap-${item.slug}`,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || undefined,
    toonSlug: item.toonSlug || undefined,
    type: item.type,
    poster: item.poster,
    backdrop: item.backdrop || item.poster,
    rating: item.rating || 8.0,
    year: item.year || 2024,
    genres: item.genres || ['Anime'],
    audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
    episodeCount: item.type === 'series' ? (item.episodes?.length || item.episodeCount || 0) : undefined,
    episodesCount: item.type === 'series' ? (item.episodes?.length || item.episodesCount || 0) : undefined,
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || item.toonStreamUrl)
      : (item.episodes?.some((e: any) => !!(e.streamUrl || e.toonStreamUrl)) ?? false),
  }));
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

async function syncNewEpisodes(db: any[]): Promise<{ newEps: number; updatedEps: number }> {
  const homeHtml = await fetchHtml('https://toonstream.us/home');
  if (!homeHtml) return { newEps: 0, updatedEps: 0 };

  const $ = cheerio.load(homeHtml);
  const freshEpUrls: string[] = [];
  $('a[href*="/episode/"]').each((_, el) => {
    const h = $(el).attr('href') || '';
    const full = h.startsWith('http') ? h : `https://toonstream.us${h}`;
    if (!freshEpUrls.includes(full)) freshEpUrls.push(full);
  });

  let newEps = 0;
  let updatedEps = 0;

  for (const epUrl of freshEpUrls.slice(0, 30)) {
    const match = epUrl.match(/\/episode\/(.+?)-(\d+)x(\d+)\/?$/i);
    if (!match) continue;

    const seriesSlug = match[1];
    const season = parseInt(match[2], 10);
    const num = parseInt(match[3], 10);

    const series = db.find((d: any) =>
      d.type === 'series' && (
        d.slug === seriesSlug ||
        (d.toonSlug || '') === seriesSlug ||
        d.slug.includes(seriesSlug) ||
        seriesSlug.includes(d.slug)
      )
    );

    if (!series) continue;
    if (!series.episodes) series.episodes = [];

    let ep = series.episodes.find((e: any) => e.season === season && e.number === num);

    if (!ep) {
      // New episode
      const html = await fetchHtml(epUrl);
      if (!html) continue;
      const streams = extractStreams(html);
      const active = streams.filter(s => !s.includes('as-cdn'));
      if (active.length === 0) continue;

      ep = {
        number: num, season,
        title: `S${season} E${num}: Episode ${num}`,
        slug: `${seriesSlug}-${season}x${num}`,
        url: epUrl, toonUrl: epUrl,
        thumbnail: series.poster || '',
        streamUrl: active[0],
        toonStreamUrl: active[0],
        streamSources: buildSources(streams),
      };
      series.episodes.push(ep);
      series.episodes.sort((a: any, b: any) => a.season === b.season ? a.number - b.number : a.season - b.season);
      series.episodeCount = series.episodes.length;
      newEps++;
      await delay(300);
    } else if (!ep.toonStreamUrl) {
      // Episode exists but needs ToonStream stream
      const html = await fetchHtml(epUrl);
      if (!html) continue;
      const streams = extractStreams(html);
      const active = streams.filter(s => !s.includes('as-cdn'));
      if (active.length === 0) continue;
      ep.toonUrl = epUrl;
      ep.toonStreamUrl = active[0];
      ep.streamUrl = active[0];
      ep.streamSources = buildSources(streams);
      updatedEps++;
      await delay(300);
    }
  }

  return { newEps, updatedEps };
}

async function syncNewMovies(db: any[]): Promise<{ newMovies: number; updatedMovies: number }> {
  let newMovies = 0;
  let updatedMovies = 0;

  // Fetch page 1 of movies on ToonStream
  const html = await fetchHtml('https://toonstream.us/category/movies?type=all&page=1');
  if (!html) return { newMovies: 0, updatedMovies: 0 };

  const $ = cheerio.load(html);
  const movieItems: Array<{ title: string; url: string; slug: string }> = [];

  $('article').each((_, el) => {
    const href = $(el).find('a[href*="/movies/"]').first().attr('href') || '';
    if (!href) return;
    const slugMatch = href.match(/\/movies\/([^/?\s]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1];
    const title = $(el).find('h2, h3, .entry-title').first().text().trim() || '';
    const url = href.startsWith('http') ? href : `https://toonstream.us${href}`;
    movieItems.push({ title, url, slug });
  });

  for (const item of movieItems.slice(0, 20)) {
    // Check if already in DB with ToonStream stream
    const existing = db.find((d: any) =>
      d.type === 'movie' && (
        d.toonSlug === item.slug ||
        d.slug === item.slug
      )
    );
    if (existing?.toonStreamUrl) continue;

    // Fetch movie page
    const html = await fetchHtml(item.url);
    if (!html) continue;
    const streams = extractStreams(html);
    const active = streams.filter(s => !s.includes('as-cdn'));
    if (active.length === 0) continue;

    if (existing) {
      existing.toonSlug = item.slug;
      existing.toonUrl = item.url;
      existing.toonStreamUrl = active[0];
      existing.streamUrl = active[0];
      existing.streamSources = buildSources(streams);
      updatedMovies++;
    }

    await delay(500);
  }

  return { newMovies, updatedMovies };
}

export async function GET(request: NextRequest) {
  // Simple secret key check to prevent unauthorized use
  const secret = request.nextUrl.searchParams.get('secret') || '';
  const EXPECTED = process.env.SYNC_SECRET || 'ap-sync-2024';
  if (secret !== EXPECTED) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!fs.existsSync(DB_PATH)) {
      return NextResponse.json({ error: 'Database not found' }, { status: 500 });
    }

    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

    const [epResult, movieResult] = await Promise.allSettled([
      syncNewEpisodes(db),
      syncNewMovies(db),
    ]);

    const epData = epResult.status === 'fulfilled' ? epResult.value : { newEps: 0, updatedEps: 0 };
    const movieData = movieResult.status === 'fulfilled' ? movieResult.value : { newMovies: 0, updatedMovies: 0 };

    const totalChanges = epData.newEps + epData.updatedEps + movieData.newMovies + movieData.updatedMovies;

    if (totalChanges > 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
      saveCatalog(db);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      changes: totalChanges,
      episodes: {
        new: epData.newEps,
        updated: epData.updatedEps,
      },
      movies: {
        new: movieData.newMovies,
        updated: movieData.updatedMovies,
      },
      message: totalChanges > 0
        ? `Synced ${totalChanges} changes from ToonStream`
        : 'Already up to date',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
