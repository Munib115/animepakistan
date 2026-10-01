/**
 * resolve_all_haz_streams.js
 * High-speed concurrent stream resolver for all HindiAnimesZone titles.
 * Resolves direct video player embeds (P2PPlay, AbyssPlayer, StrmUp) and merges into anime-db.json.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const CACHE_PATH = path.join(__dirname, 'haz_scraped_data.json');

function fetchUrl(url, maxRedirects = 3) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) return resolve('');
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://hindianimeszone.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 8000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          try {
            const uObj = new URL(url);
            redirectUrl = `${uObj.protocol}//${uObj.host}${redirectUrl}`;
          } catch (e) {
            redirectUrl = 'https://002.hindianimeszone.com' + redirectUrl;
          }
        }
        return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve);
      }
      if (res.statusCode !== 200) return resolve('');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

async function resolvePlayOnlineStreams(playOnlineUrl) {
  if (!playOnlineUrl || !playOnlineUrl.includes('playonline.php')) return [];
  const html = await fetchUrl(playOnlineUrl);
  if (!html) return [];

  const streams = [];
  // 1. servers array
  const serverMatch = html.match(/servers\s*=\s*\[(.*?)\];/s);
  if (serverMatch) {
    const raw = serverMatch[1];
    const matches = [...raw.matchAll(/"([^"]+)"/g)].map(m => m[1].replace(/\\\//g, '/').trim());
    matches.forEach(m => {
      if (m.startsWith('http') && !streams.includes(m)) streams.push(m);
    });
  }

  // 2. iframes
  const iframes = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/gi)].map(m => m[1].trim());
  iframes.forEach(i => {
    if (i.startsWith('http') && !streams.includes(i) && !i.includes('cloudflare') && !i.includes('google')) {
      streams.push(i);
    }
  });

  return streams;
}

function formatStreamSources(urls, fallbackPlayOnline) {
  const sources = [];
  const priorityOrder = (u) => {
    const l = u.toLowerCase();
    if (l.includes('abyss')) return 1;
    if (l.includes('p2p')) return 2;
    if (l.includes('strmup')) return 3;
    return 4;
  };

  const sorted = [...urls].sort((a, b) => priorityOrder(a) - priorityOrder(b));
  sorted.forEach(u => {
    let label = 'HAZ Mirror';
    if (u.includes('abyss')) label = 'Abyss (Multi Audio)';
    else if (u.includes('p2p')) label = 'HAZ Player (Hindi HD)';
    else if (u.includes('strmup')) label = 'StrmUp (Multi Audio)';
    sources.push({ label, url: u, isMultiAudio: true });
  });

  if (fallbackPlayOnline && !sources.some(s => s.url === fallbackPlayOnline)) {
    sources.push({ label: 'HAZ Server (Hindi)', url: fallbackPlayOnline, isMultiAudio: true });
  }

  return sources;
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`🚀 Resolving Direct Streams for HindiAnimesZone Titles`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(CACHE_PATH)) {
    console.error(`Cache not found at ${CACHE_PATH}. Run scrape_haz_master.js first.`);
    return;
  }

  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  const items = Object.values(cache);
  console.log(`Loaded ${items.length} items from cache.`);

  // 1. Resolve movies
  console.log('\n--- 1. Resolving Movies Direct Streams ---');
  const movies = items.filter(i => i.isMovie && (i.moviePlayOnlineUrl || (i.episodes && i.episodes.length > 0)));
  console.log(`Found ${movies.length} movies.`);

  for (const m of movies) {
    const targetUrl = m.moviePlayOnlineUrl || m.episodes?.[0]?.playOnlineUrl;
    if (targetUrl && (!m.streamSources || m.streamSources.length === 0)) {
      process.stdout.write(`Resolving movie: ${m.title}... `);
      const streams = await resolvePlayOnlineStreams(targetUrl);
      if (streams.length > 0) {
        m.streamSources = formatStreamSources(streams, targetUrl);
        console.log(`Found ${streams.length} streams.`);
      } else {
        m.streamSources = [{ label: 'HAZ Server (Hindi)', url: targetUrl, isMultiAudio: true }];
        console.log(`Using fallback playonline.`);
      }
    }
  }

  // 2. Resolve series episodes with concurrency
  console.log('\n--- 2. Resolving Series Direct Streams (Episodes 1-6 per series) ---');
  const series = items.filter(i => !i.isMovie && i.episodes && i.episodes.length > 0);
  console.log(`Found ${series.length} series.`);

  // Build task queue of episodes to resolve
  const episodeTasks = [];
  series.forEach(s => {
    // Resolve initial episodes (up to 6) for rapid playback
    s.episodes.slice(0, 6).forEach(ep => {
      if (ep.playOnlineUrl && (!ep.streamSources || ep.streamSources.length === 0)) {
        episodeTasks.push({ seriesTitle: s.title, ep });
      }
    });
  });

  console.log(`Total episodes to resolve: ${episodeTasks.length}`);
  const CONCURRENCY = 12;
  let taskIndex = 0;
  let resolvedCount = 0;

  async function worker() {
    while (taskIndex < episodeTasks.length) {
      const idx = taskIndex++;
      const { ep } = episodeTasks[idx];
      try {
        const streams = await resolvePlayOnlineStreams(ep.playOnlineUrl);
        if (streams.length > 0) {
          ep.streamSources = formatStreamSources(streams, ep.playOnlineUrl);
          resolvedCount++;
        } else {
          ep.streamSources = [{ label: 'HAZ Server (Hindi)', url: ep.playOnlineUrl, isMultiAudio: true }];
        }
      } catch (e) {
        ep.streamSources = [{ label: 'HAZ Server (Hindi)', url: ep.playOnlineUrl, isMultiAudio: true }];
      }

      if (idx > 0 && idx % 100 === 0) {
        console.log(`Progress: ${idx}/${episodeTasks.length} episodes resolved (${resolvedCount} multi-mirror streams).`);
        fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`\nFinished resolving! Total direct streams resolved: ${resolvedCount}`);

  // 3. Merge into anime-db.json
  console.log('\n--- 3. Merging Direct Streams into anime-db.json ---');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  let updatedCount = 0;

  for (const item of items) {
    if (!item.title) continue;

    const cleanTitle = item.title
      .toLowerCase()
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/season\s*\d+/gi, '')
      .replace(/movie/gi, '')
      .replace(/hindi|dubbed|multi|audio|480p|720p|1080p|hd|web-dl|bluray|esub/gi, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const matched = db.find(a => {
      const aTitle = (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return (
        aTitle === cleanTitle ||
        (cleanTitle.length > 6 && aTitle.includes(cleanTitle)) ||
        (aTitle.length > 6 && cleanTitle.includes(aTitle)) ||
        (a.id && a.id.includes(item.slug))
      );
    });

    if (matched) {
      if (item.languages && item.languages.length > 0) {
        matched.audioLanguages = [...new Set([...(matched.audioLanguages || []), ...item.languages])];
      }

      if (matched.type === 'movie' && item.streamSources && item.streamSources.length > 0) {
        const existing = matched.streamSources || [];
        const nonHaz = existing.filter(s => !s.label?.includes('HAZ') && !s.url?.includes('hindianimeszone') && !s.url?.includes('p2pplay'));
        matched.streamSources = [...item.streamSources, ...nonHaz];
        matched.hazStreamUrl = item.streamSources[0].url;
        updatedCount++;
      }

      if (matched.type === 'series' && item.episodes && item.episodes.length > 0) {
        if (!matched.episodes) matched.episodes = [];
        let epUpdated = 0;

        item.episodes.forEach(hazEp => {
          let foundEp = matched.episodes.find(e => e.number === hazEp.number);
          if (!foundEp) {
            foundEp = {
              number: hazEp.number,
              title: hazEp.title || `Episode ${hazEp.number}`,
              slug: `${matched.slug}-${hazEp.number}`,
              streamSources: []
            };
            matched.episodes.push(foundEp);
          }

          if (hazEp.streamSources && hazEp.streamSources.length > 0) {
            const existing = foundEp.streamSources || [];
            const nonHaz = existing.filter(s => !s.label?.includes('HAZ') && !s.url?.includes('hindianimeszone') && !s.url?.includes('p2pplay'));
            foundEp.streamSources = [...hazEp.streamSources, ...nonHaz];
            foundEp.hazStreamUrl = hazEp.streamSources[0].url;
            epUpdated++;
          }
        });

        if (epUpdated > 0) updatedCount++;
      }
    }
  }

  console.log(`Updated streams for ${updatedCount} titles in anime-db.json.`);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  // 4. Regenerate anime-catalog.json
  console.log('\n--- 4. Regenerating anime-catalog.json ---');
  const catalog = db.map(item => ({
    id: item.id || `ap-${item.slug}`,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || undefined,
    toonSlug: item.toonSlug || undefined,
    type: item.type || 'series',
    poster: item.poster || '',
    backdrop: item.backdrop || item.poster || '',
    genres: item.genres || ['Anime'],
    audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
    rating: item.rating || 8.0,
    year: item.year || 2024,
    episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    episodesCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || (item.streamSources && item.streamSources.length > 0))
      : (item.episodes?.some(e => !!(e.streamUrl || (e.streamSources && e.streamSources.length > 0))) ?? false),
    source: item.source || 'hybrid'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved anime-catalog.json (${catalog.length} items).`);

  console.log(`\n======================================================`);
  console.log(`🎉 ALL HAZ Streams Resolved & Synchronized Successfully!`);
  console.log(`======================================================\n`);
}

run().catch(console.error);
