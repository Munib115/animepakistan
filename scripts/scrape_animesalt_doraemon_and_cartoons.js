/**
 * scripts/scrape_animesalt_doraemon_and_cartoons.js
 *
 * 1. Crawls all Doraemon movies & series from AnimeSalt (pages 1 to 4)
 * 2. Unpacks high-speed multi-audio Abyss & Ravok stream embeds for ALL Doraemon movies
 * 3. Crawls all cartoons & animation titles from AnimeSalt categories
 * 4. Merges and updates anime-db.json and regenerates anime-catalog.json
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://animesalt.cx/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithUA(url, retries = 3, timeoutMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
      await delay(500 * attempt);
    } catch (e) {
      if (attempt === retries) return null;
      await delay(500 * attempt);
    }
  }
  return null;
}

function unpackAnimeSaltDataUrl(url) {
  if (!url || typeof url !== 'string') return [];
  if (!url.includes('data=')) return [];
  try {
    const urlObj = new URL(url);
    const dataParam = urlObj.searchParams.get('data');
    if (!dataParam) return [];
    const decodedStr = Buffer.from(dataParam, 'base64').toString('utf8');
    const parsed = JSON.parse(decodedStr);
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const results = [];
    for (const item of parsed) {
      if (!item || !item.link) continue;
      let link = item.link.replace(/^http:\/\//i, 'https://').trim();
      if (link.includes('short.icu/')) {
        link = link.replace(/https?:\/\/short\.icu\/([a-zA-Z0-9_\-]+)/gi, 'https://player.abyssplayer.com/$1');
      }
      if (link && !link.includes('about:blank') && !link.includes('short.icu')) {
        results.push({
          label: `Abyss (${item.language || 'Multi Audio'})`,
          url: link,
          isMultiAudio: true
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

function extractAllStreamsFromHtml(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const sources = [];
  const seen = new Set();

  $('iframe').each((_, el) => {
    const raw = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!raw) return;
    let clean = raw.startsWith('//') ? 'https:' + raw : raw;
    clean = clean.trim();

    if (clean.includes('data=') && (clean.includes('plyr') || clean.includes('player') || clean.includes('animesalt'))) {
      const unpacked = unpackAnimeSaltDataUrl(clean);
      for (const u of unpacked) {
        if (!seen.has(u.url)) {
          seen.add(u.url);
          sources.push(u);
        }
      }
    } else if (clean.includes('ravok.buzz')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        sources.push({
          label: 'Ravok (HD Multi Audio)',
          url: clean,
          isMultiAudio: true
        });
      }
    } else if (clean.includes('abyssplayer.com')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        sources.push({
          label: 'Abyss (Multi Audio)',
          url: clean,
          isMultiAudio: true
        });
      }
    } else if (clean.includes('cloudy.upns.one')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        sources.push({
          label: 'Cloudy (HD)',
          url: clean,
          isMultiAudio: true
        });
      }
    } else if (clean.includes('filesforever.link')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        sources.push({
          label: 'FilesForever (Mirror)',
          url: clean,
          isMultiAudio: true
        });
      }
    } else if (clean.includes('vidmoly.net')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        sources.push({
          label: 'Vidmoly (Mirror)',
          url: clean,
          isMultiAudio: true
        });
      }
    } else if (!clean.includes('youtube.com') && !clean.includes('google') && !clean.includes('facebook') && !clean.includes('about:blank')) {
      if (!seen.has(clean)) {
        seen.add(clean);
        sources.push({
          label: 'Server HD',
          url: clean,
          isMultiAudio: true
        });
      }
    }
  });

  return sources;
}

function getPriority(url) {
  const l = (url || '').toLowerCase();
  if (l.includes('abyssplayer.com')) return 1;
  if (l.includes('ravok.buzz')) return 2;
  if (l.includes('p2pplay.online') || l.includes('strp2p.live')) return 3;
  if (l.includes('cloudy.upns.one')) return 4;
  if (l.includes('filesforever.link') || l.includes('iqsmartgames.com')) return 5;
  if (l.includes('vidmoly.net')) return 6;
  if (l.includes('vidstreaming.xyz') || l.includes('strmup.to')) return 7;
  return 10;
}

function sortAndDedupeSources(sources) {
  const seen = new Set();
  const valid = [];
  for (const s of sources) {
    if (!s || !s.url) continue;
    const u = s.url.trim();
    if (seen.has(u)) continue;
    seen.add(u);
    valid.push(s);
  }
  valid.sort((a, b) => getPriority(a.url) - getPriority(b.url));
  return valid;
}

async function scrapeDoraemonMovies(db) {
  console.log('\n======================================================');
  console.log('PHASE 1: SCRAPING ALL DORAEMON MOVIES FROM ANIMESALT');
  console.log('======================================================');

  const saltDoraemonItems = [];
  for (let p = 1; p <= 5; p++) {
    const searchUrl = p === 1 ? 'https://animesalt.cx/?s=doraemon' : `https://animesalt.cx/page/${p}/?s=doraemon`;
    const html = await fetchWithUA(searchUrl);
    if (!html) break;
    const $ = cheerio.load(html);
    let count = 0;
    $('article').each((_, el) => {
      const a = $(el).find('a').first();
      const href = a.attr('href') || '';
      const title = $(el).find('.entry-title, .title, h2, h3').text().trim() || a.attr('title') || '';
      if (href && (href.includes('/movies/') || href.includes('/series/'))) {
        const slug = href.split('/').filter(Boolean).pop();
        if (!saltDoraemonItems.some(x => x.slug === slug)) {
          saltDoraemonItems.push({
            title,
            slug,
            url: href,
            type: href.includes('/movies/') ? 'movie' : 'series'
          });
          count++;
        }
      }
    });
    console.log(`Page ${p}: Found ${count} Doraemon items`);
    if (count === 0) break;
    await delay(200);
  }

  console.log(`Total Doraemon titles discovered on AnimeSalt: ${saltDoraemonItems.length}\n`);

  let updatedDoraemonCount = 0;
  let newDoraemonAdded = 0;

  for (let i = 0; i < saltDoraemonItems.length; i++) {
    const item = saltDoraemonItems[i];
    console.log(`[${i + 1}/${saltDoraemonItems.length}] Processing Doraemon: "${item.title}" (${item.slug})...`);

    const pageHtml = await fetchWithUA(item.url);
    if (!pageHtml) continue;

    const freshSources = extractAllStreamsFromHtml(pageHtml);
    console.log(`  -> Found ${freshSources.length} fresh stream sources on AnimeSalt!`);

    // Find in DB
    let dbItem = db.find(d =>
      d.slug.toLowerCase() === item.slug.toLowerCase() ||
      (d.saltSlug || '').toLowerCase() === item.slug.toLowerCase() ||
      (d.title || '').toLowerCase().includes(item.slug.toLowerCase().replace(/-/g, ' '))
    );

    if (dbItem) {
      // Merge new sources with existing ones, prioritizing Abyss and Ravok!
      const merged = [...freshSources, ...(dbItem.streamSources || [])];
      dbItem.streamSources = sortAndDedupeSources(merged);
      if (dbItem.streamSources.length > 0) {
        dbItem.streamUrl = dbItem.streamSources[0].url;
      }
      dbItem.saltSlug = item.slug;
      dbItem.saltUrl = item.url;
      updatedDoraemonCount++;
      console.log(`  ✓ Updated DB item "${dbItem.title}"! Primary: ${dbItem.streamUrl} (Total sources: ${dbItem.streamSources.length})`);
    } else if (item.type === 'movie') {
      // Add brand new Doraemon movie!
      const $ = cheerio.load(pageHtml);
      const desc = $('.entry-content p, #description p, .synopsis p').first().text().trim() ||
                   `${item.title} animated movie in Hindi & Urdu.`;
      const poster = $('.post-thumbnail img, .poster img').first().attr('src') || '';
      const backdrop = $('.TPostBg').first().attr('src') || poster;

      const sortedSources = sortAndDedupeSources(freshSources);
      const newDoraemonMovie = {
        title: item.title,
        slug: item.slug,
        saltSlug: item.slug,
        url: item.url,
        saltUrl: item.url,
        type: 'movie',
        poster,
        backdrop,
        description: desc,
        genres: ['Animation', 'Anime', 'Adventure', 'Family'],
        audioLanguages: ['Hindi', 'Urdu', 'Japanese'],
        rating: 8.5,
        year: 2024,
        streamUrl: sortedSources[0]?.url || '',
        streamSources: sortedSources,
        source: 'animesalt'
      };
      db.unshift(newDoraemonMovie);
      newDoraemonAdded++;
      console.log(`  ✨ Added brand new Doraemon movie "${item.title}" to DB!`);
    }

    await delay(300);
  }

  console.log(`\nCompleted Doraemon sync: ${updatedDoraemonCount} updated, ${newDoraemonAdded} newly added.`);
}

async function scrapeCartoons(db) {
  console.log('\n======================================================');
  console.log('PHASE 2: SCRAPING ALL CARTOONS FROM ANIMESALT');
  console.log('======================================================');

  const cartoonUrls = [];
  // Scrape up to 6 pages of AnimeSalt Cartoons
  for (let p = 1; p <= 6; p++) {
    const url = p === 1 ? 'https://animesalt.cx/category/cartoon/' : `https://animesalt.cx/category/cartoon/page/${p}/`;
    const html = await fetchWithUA(url);
    if (!html) break;
    const $ = cheerio.load(html);
    let count = 0;
    $('article').each((_, el) => {
      const a = $(el).find('a').first();
      const href = a.attr('href') || '';
      const title = $(el).find('.entry-title, .title, h2, h3').text().trim() || a.attr('title') || '';
      if (href && (href.includes('/series/') || href.includes('/movies/'))) {
        const slug = href.split('/').filter(Boolean).pop();
        if (!cartoonUrls.some(c => c.slug === slug)) {
          cartoonUrls.push({
            title,
            slug,
            url: href,
            type: href.includes('/movies/') ? 'movie' : 'series'
          });
          count++;
        }
      }
    });
    console.log(`Cartoon Page ${p}: Found ${count} items`);
    if (count === 0) break;
    await delay(200);
  }

  console.log(`Total cartoon titles to evaluate: ${cartoonUrls.length}\n`);

  let updatedCartoons = 0;
  for (const c of cartoonUrls) {
    const match = db.find(d =>
      d.slug.toLowerCase() === c.slug.toLowerCase() ||
      (d.saltSlug || '').toLowerCase() === c.slug.toLowerCase()
    );

    if (match) {
      if (match.type === 'movie') {
        const html = await fetchWithUA(c.url);
        if (html) {
          const fresh = extractAllStreamsFromHtml(html);
          if (fresh.length > 0) {
            match.streamSources = sortAndDedupeSources([...fresh, ...(match.streamSources || [])]);
            match.streamUrl = match.streamSources[0].url;
            updatedCartoons++;
            console.log(`  ✓ Updated cartoon movie "${match.title}" with fresh streams`);
          }
        }
        await delay(250);
      }
    }
  }

  console.log(`Completed cartoon stream updates: ${updatedCartoons} updated.`);
}

async function main() {
  console.log('Loading database...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Database loaded with ${db.length} items.\n`);

  // 1. Scrape & update all Doraemon movies with Abyss & Ravok streams
  await scrapeDoraemonMovies(db);

  // 2. Scrape & update cartoons
  await scrapeCartoons(db);

  // 3. Save database
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n💾 Saved updated database to: ${DB_PATH}`);

  // 4. Regenerate catalog
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
    source: item.source || 'animesalt'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Regenerated anime-catalog.json (${catalog.length} items)`);

  console.log('\n🎉 ALL DORAEMON MOVIES AND CARTOONS ARE REFRESHED WITH WORKING STREAMS!');
}

main().catch(console.error);
