/**
 * scrape_haz_master.js
 * Scrapes all anime, cartoon shows, and movies from https://hindianimeszone.com/
 * Resolves direct player streams (AbyssPlayer, P2PPlay, StrmUp) and merges into anime-db.json.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const CACHE_PATH = path.join(__dirname, 'haz_scraped_data.json');
const BASE_URL = 'https://hindianimeszone.com';
const TOTAL_PAGES = 53;

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
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = BASE_URL + redirectUrl;
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

/**
 * Resolves playonline.php to direct player embeds (AbyssPlayer, P2PPlay, StrmUp)
 */
async function resolvePlayOnlineStreams(playOnlineUrl) {
  if (!playOnlineUrl || !playOnlineUrl.includes('playonline.php')) return [];
  const html = await fetchUrl(playOnlineUrl);
  if (!html) return [];

  const streams = [];
  // 1. Check servers = ["...", "..."]
  const serverMatch = html.match(/servers\s*=\s*\[(.*?)\];/s);
  if (serverMatch) {
    const raw = serverMatch[1];
    const matches = [...raw.matchAll(/"([^"]+)"/g)].map(m => m[1].replace(/\\\//g, '/').trim());
    matches.forEach(m => {
      if (m.startsWith('http') && !streams.includes(m)) streams.push(m);
    });
  }

  // 2. Check iframes
  const iframes = [...html.matchAll(/<iframe[^>]+src="([^"]+)"/gi)].map(m => m[1].trim());
  iframes.forEach(i => {
    if (i.startsWith('http') && !streams.includes(i) && !i.includes('cloudflare') && !i.includes('google')) {
      streams.push(i);
    }
  });

  return streams;
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/['":!?()&\[\]|]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseLanguages(text) {
  const list = [];
  const lower = (text || '').toLowerCase();
  if (lower.includes('hindi')) list.push('Hindi');
  if (lower.includes('tamil')) list.push('Tamil');
  if (lower.includes('telugu')) list.push('Telugu');
  if (lower.includes('kannada')) list.push('Kannada');
  if (lower.includes('malayalam')) list.push('Malayalam');
  if (lower.includes('bengali')) list.push('Bengali');
  if (lower.includes('eng')) list.push('English');
  if (lower.includes('jpn') || lower.includes('japanese')) list.push('Japanese');
  if (lower.includes('kor') || lower.includes('korean')) list.push('Korean');
  return list.length > 0 ? list : ['Hindi'];
}

function parsePostHtml(html, postUrl, fallbackTitle) {
  // Title
  const titleMatch = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>(.*?)<\/h1>/is);
  const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : fallbackTitle;
  const cleanTitle = rawTitle
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  // Poster Image
  const poster = html.match(/<meta property="og:image" content="([^"]+)"/i)?.[1] ||
                 html.match(/<img[^>]+class="[^"]*entry-thumb[^"]*"[^>]+src="([^"]+)"/i)?.[1] || '';

  // Type: movie or series
  const isMovie = /movie/i.test(cleanTitle) || html.includes('/category/movie/');

  // Audio Languages
  const languages = parseLanguages(cleanTitle + ' ' + html);

  // Synopsis
  const synopsisMatch = html.match(/<div class="td-post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  let synopsis = '';
  if (synopsisMatch) {
    const pMatches = [...synopsisMatch[1].matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    for (const p of pMatches) {
      const txt = p[1].replace(/<[^>]+>/g, '').trim();
      if (txt.length > 50 && !txt.includes('Download') && !txt.includes('Screenshots')) {
        synopsis = txt;
        break;
      }
    }
  }

  // Episodes & Streams
  const episodes = [];
  const epBlocks = [...html.matchAll(/<span[^>]*class="episode-title"[^>]*>([^<]+)<\/span>[\s\S]*?<a[^>]*href="([^"]*playonline\.php[^"]*)"/gi)];
  if (epBlocks.length > 0) {
    for (const eb of epBlocks) {
      const epNumMatch = eb[1].match(/\d+/);
      const epNum = epNumMatch ? parseInt(epNumMatch[0]) : episodes.length + 1;
      episodes.push({
        number: epNum,
        title: eb[1].trim(),
        playOnlineUrl: eb[2].trim().replace(/&amp;/g, '&')
      });
    }
  }

  // Pattern 2: watch-online class links
  if (episodes.length === 0) {
    const watchLinks = [...html.matchAll(/<a[^>]*class="[^"]*watch-online[^"]*"[^>]*href="([^"]*playonline\.php[^"]*)"/gi)];
    if (watchLinks.length > 0) {
      watchLinks.forEach((w, idx) => {
        episodes.push({
          number: idx + 1,
          title: `Episode ${idx + 1}`,
          playOnlineUrl: w[1].trim().replace(/&amp;/g, '&')
        });
      });
    }
  }

  // Pattern 3: General playonline links
  if (episodes.length === 0) {
    const allPlayOnline = [...html.matchAll(/href="([^"]*playonline\.php[^"]*code=[^"]*)"/gi)];
    const seen = new Set();
    allPlayOnline.forEach(m => {
      const u = m[1].replace(/&amp;/g, '&').trim();
      if (!seen.has(u)) {
        seen.add(u);
        episodes.push({
          number: episodes.length + 1,
          title: isMovie ? cleanTitle : `Episode ${episodes.length + 1}`,
          playOnlineUrl: u
        });
      }
    });
  }

  return {
    title: cleanTitle,
    url: postUrl,
    poster,
    isMovie,
    type: isMovie ? 'movie' : 'series',
    languages,
    synopsis: synopsis || `${cleanTitle} in Hindi Dubbed. Watch Online with multi-audio support on AnimePakistan.`,
    episodes,
    moviePlayOnlineUrl: isMovie && episodes.length > 0 ? episodes[0].playOnlineUrl : null
  };
}

async function scrapeAllCatalog() {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting HindiAnimesZone Full Catalog Crawl`);
  console.log(`Total archive pages: ${TOTAL_PAGES}`);
  console.log(`======================================================\n`);

  let cache = {};
  if (fs.existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      console.log(`Loaded ${Object.keys(cache).length} posts from existing cache.`);
    } catch (e) {
      cache = {};
    }
  }

  const postLinksMap = new Map();

  // 1. Crawl index pages
  console.log('--- Step 1: Crawling Archive Pages [1..' + TOTAL_PAGES + '] ---');
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const pageUrl = page === 1 ? `${BASE_URL}/page/1/` : `${BASE_URL}/page/${page}/`;
    process.stdout.write(`Fetching page ${page}/${TOTAL_PAGES}... `);
    const html = await fetchUrl(pageUrl);
    if (!html) {
      console.log('Failed or empty.');
      continue;
    }

    const matches = [...html.matchAll(/<h3 class="entry-title td-module-title"><a href="([^"]+)"[^>]*title="([^"]+)"/gi)];
    matches.forEach(m => {
      if (!postLinksMap.has(m[1])) {
        postLinksMap.set(m[1], m[2]);
      }
    });
    console.log(`Found ${matches.length} posts (Total unique: ${postLinksMap.size})`);
  }

  console.log(`\nDiscovered ${postLinksMap.size} total posts from HindiAnimesZone!`);

  // 2. Fetch and parse each post
  console.log('\n--- Step 2: Scraping Post Details & Stream Links ---');
  const postEntries = [...postLinksMap.entries()];
  let scrapedCount = 0;
  let skippedCount = 0;

  // Concurrency worker pool
  const CONCURRENCY = 8;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < postEntries.length) {
      const idx = currentIndex++;
      const [url, fallbackTitle] = postEntries[idx];

      // Check if already in cache and has episodes/streams
      if (cache[url] && (cache[url].episodes?.length > 0 || cache[url].moviePlayOnlineUrl)) {
        skippedCount++;
        continue;
      }

      try {
        const postHtml = await fetchUrl(url);
        if (!postHtml) continue;
        const parsed = parsePostHtml(postHtml, url, fallbackTitle);
        cache[url] = parsed;
        scrapedCount++;

        if (scrapedCount % 25 === 0) {
          console.log(`Progress: ${idx + 1}/${postEntries.length} posts scraped. (${Object.keys(cache).length} cached)`);
          fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
        }
      } catch (err) {
        console.error(`Error scraping ${url}:`, err.message);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`\nFinished Scraping! Total cached posts: ${Object.keys(cache).length}`);

  // 3. Pre-resolve active stream mirrors for movies and popular series episodes
  console.log('\n--- Step 3: Resolving Direct Player Streams (Abyss, P2PPlay, StrmUp) ---');
  let resolvedStreamsCount = 0;
  const items = Object.values(cache);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // Resolve for movies
    if (item.isMovie && item.moviePlayOnlineUrl && (!item.streamSources || item.streamSources.length === 0)) {
      const streams = await resolvePlayOnlineStreams(item.moviePlayOnlineUrl);
      if (streams.length > 0) {
        item.streamSources = streams.map(s => ({
          label: s.includes('abyss') ? 'Abyss (Multi Audio)' : s.includes('p2p') ? 'HAZ Player (Hindi HD)' : s.includes('strmup') ? 'StrmUp (Multi Audio)' : 'HAZ Mirror',
          url: s,
          isMultiAudio: true
        }));
        resolvedStreamsCount++;
      }
    }

    // Resolve first 5 episodes for each series so initial playback is instantaneous
    if (!item.isMovie && item.episodes && item.episodes.length > 0) {
      for (const ep of item.episodes.slice(0, 5)) {
        if (ep.playOnlineUrl && (!ep.streamSources || ep.streamSources.length === 0)) {
          const streams = await resolvePlayOnlineStreams(ep.playOnlineUrl);
          if (streams.length > 0) {
            ep.streamSources = streams.map(s => ({
              label: s.includes('abyss') ? 'Abyss (Multi Audio)' : s.includes('p2p') ? 'HAZ Player (Hindi HD)' : s.includes('strmup') ? 'StrmUp (Multi Audio)' : 'HAZ Mirror',
              url: s,
              isMultiAudio: true
            }));
            resolvedStreamsCount++;
          }
        }
      }
    }

    if ((i + 1) % 50 === 0) {
      console.log(`Resolved stream mirrors for ${i + 1}/${items.length} titles...`);
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    }
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  console.log(`Resolved direct stream mirrors for ${resolvedStreamsCount} items/episodes!`);

  // 4. Merge into anime-db.json
  console.log('\n--- Step 4: Merging HindiAnimesZone into anime-db.json ---');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Current anime-db.json has ${db.length} items.`);

  let mergedCount = 0;
  let newAddedCount = 0;

  for (const item of Object.values(cache)) {
    if (!item.title) continue;

    // Find match in anime-db.json
    const cleanTitle = item.title
      .toLowerCase()
      .replace(/\[.*?\]|\(.*?\)/g, '')
      .replace(/season\s*\d+/gi, '')
      .replace(/movie/gi, '')
      .replace(/hindi|dubbed|multi|audio|480p|720p|1080p|hd|web-dl|bluray|esub/gi, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const matchedAnime = db.find(a => {
      const aTitle = (a.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return (
        aTitle === cleanTitle ||
        (cleanTitle.length > 6 && aTitle.includes(cleanTitle)) ||
        (aTitle.length > 6 && cleanTitle.includes(aTitle)) ||
        (a.slug && slugify(cleanTitle).includes(a.slug))
      );
    });

    if (matchedAnime) {
      // Merge into existing anime
      matchedAnime.hazUrl = item.url;
      if (item.languages && item.languages.length > 0) {
        matchedAnime.audioLanguages = [...new Set([...(matchedAnime.audioLanguages || []), ...item.languages])];
      }

      // Merge movie stream
      if (matchedAnime.type === 'movie') {
        const hazSources = item.streamSources || [];
        if (item.moviePlayOnlineUrl && !hazSources.some(s => s.url === item.moviePlayOnlineUrl)) {
          hazSources.push({
            label: 'HAZ Server (Hindi)',
            url: item.moviePlayOnlineUrl,
            isMultiAudio: true
          });
        }

        if (hazSources.length > 0) {
          const existing = matchedAnime.streamSources || [];
          const nonHaz = existing.filter(s => !s.label?.includes('HAZ') && !s.url?.includes('hindianimeszone') && !s.url?.includes('p2pplay'));
          // Put working HAZ and fast mirrors at top
          matchedAnime.streamSources = [...hazSources, ...nonHaz];
          matchedAnime.hazStreamUrl = hazSources[0].url;
          mergedCount++;
        }
      }

      // Merge series episodes
      if (matchedAnime.type === 'series' && item.episodes && item.episodes.length > 0) {
        if (!matchedAnime.episodes) matchedAnime.episodes = [];
        let epMerged = 0;

        item.episodes.forEach(hazEp => {
          let foundEp = matchedAnime.episodes.find(e => e.number === hazEp.number);
          if (!foundEp) {
            foundEp = {
              number: hazEp.number,
              title: hazEp.title || `Episode ${hazEp.number}`,
              slug: `${matchedAnime.slug}-${hazEp.number}`,
              streamSources: []
            };
            matchedAnime.episodes.push(foundEp);
          }

          const hazEpSources = hazEp.streamSources || [];
          if (hazEp.playOnlineUrl && !hazEpSources.some(s => s.url === hazEp.playOnlineUrl)) {
            hazEpSources.push({
              label: 'HAZ Server (Hindi)',
              url: hazEp.playOnlineUrl,
              isMultiAudio: true
            });
          }

          if (hazEpSources.length > 0) {
            const existing = foundEp.streamSources || [];
            const nonHaz = existing.filter(s => !s.label?.includes('HAZ') && !s.url?.includes('hindianimeszone') && !s.url?.includes('p2pplay'));
            foundEp.streamSources = [...hazEpSources, ...nonHaz];
            foundEp.hazStreamUrl = hazEpSources[0].url;
            epMerged++;
          }
        });

        if (epMerged > 0) mergedCount++;
      }
    } else {
      // Add as new entry to anime-db.json if it has playable streams
      const hasStreams = (item.isMovie && (item.moviePlayOnlineUrl || (item.streamSources && item.streamSources.length > 0))) ||
                         (!item.isMovie && item.episodes && item.episodes.length > 0);

      if (hasStreams) {
        const newSlug = slugify(item.title);
        const newItem = {
          id: `haz-${newSlug}`,
          slug: newSlug,
          title: item.title.replace(/\s*\[.*?\]|\s*\(.*?\)/g, '').trim(),
          type: item.type,
          poster: item.poster || '/images/default-poster.jpg',
          banner: item.poster || '/images/default-banner.jpg',
          synopsis: item.synopsis,
          genres: ['Action', 'Adventure', 'Anime'],
          audioLanguages: item.languages,
          hazUrl: item.url,
          streamSources: item.isMovie ? (item.streamSources || [{ label: 'HAZ Server (Hindi)', url: item.moviePlayOnlineUrl, isMultiAudio: true }]) : [],
          episodes: !item.isMovie ? item.episodes.map(e => ({
            number: e.number,
            title: e.title || `Episode ${e.number}`,
            slug: `${newSlug}-${e.number}`,
            streamSources: e.streamSources || (e.playOnlineUrl ? [{ label: 'HAZ Server (Hindi)', url: e.playOnlineUrl, isMultiAudio: true }] : [])
          })) : []
        };
        db.push(newItem);
        newAddedCount++;
      }
    }
  }

  console.log(`Merged HAZ streams into ${mergedCount} existing titles.`);
  console.log(`Added ${newAddedCount} new HAZ-exclusive titles to database.`);
  console.log(`Total database size is now: ${db.length} titles.`);

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`Saved updated database to ${DB_PATH}.`);

  // Regenerate anime-catalog.json for frontend
  console.log('\nRegenerating anime-catalog.json for instant frontend loading...');
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
  console.log(`🎉 HindiAnimesZone Scraping & Database Merge COMPLETE!`);
  console.log(`======================================================\n`);
}

scrapeAllCatalog().catch(console.error);
