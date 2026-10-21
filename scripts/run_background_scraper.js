/**
 * scripts/run_background_scraper.js
 *
 * Comprehensive Background Scraper for Anime, Cartoons & New Episodes:
 * - Scrapes AnimeSalt & ToonStream
 * - Pulls latest anime series, movies, and cartoon drops
 * - Discovers brand new titles & newly released episodes
 * - Resolves working stream sources (Abyss multi-audio, Ravok, MegaPlay, etc.)
 * - Preserves existing streams & metadata cleanly
 * - Updates anime-db.json & regenerates anime-catalog.json
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url, retries = 3, timeoutMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { ...HEADERS, 'Referer': url }, signal: controller.signal });
      clearTimeout(id);
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
      await delay(500 * attempt);
    } catch (e) {
      clearTimeout(id);
      if (attempt === retries) return null;
      await delay(500 * attempt);
    }
  }
  return null;
}

function sanitizeStreamUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let clean = url
    .replace(/^http:\/\//i, 'https://')
    .replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top')
    .replace(/animesalt\.(link|me)/gi, 'animesalt.cx')
    .trim();
  if (clean.includes('short.icu/')) {
    clean = clean.replace(/https?:\/\/short\.icu\/([a-zA-Z0-9_\-]+)/gi, 'https://player.abyssplayer.com/$1');
  }
  return clean;
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
      const clean = sanitizeStreamUrl(item.link);
      if (clean) {
        results.push({
          label: `Abyss (${item.language || 'HD'})`,
          url: clean,
          isMultiAudio: true,
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

async function fetchEpisodeStreams(epUrl) {
  const sources = [];
  try {
    const html = await fetchHtml(epUrl, 2, 8000);
    if (!html) return { streamUrl: '', sources: [] };
    const $ = cheerio.load(html);

    $('iframe').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src') || '';
      if (!src) return;
      if (src.startsWith('//')) src = 'https:' + src;

      if (src.includes('data=')) {
        const unpacked = unpackAnimeSaltDataUrl(src);
        for (const u of unpacked) {
          if (!sources.some(s => s.url === u.url)) sources.push(u);
        }
      } else if (
        src.includes('abyssplayer') ||
        src.includes('ravok.buzz') ||
        src.includes('megaplay.buzz') ||
        src.includes('as-cdn') ||
        src.includes('cloudy') ||
        src.includes('vidstreaming') ||
        src.includes('filesforever') ||
        src.includes('emturbovid')
      ) {
        const clean = sanitizeStreamUrl(src);
        if (clean && !sources.some(s => s.url === clean)) {
          let label = 'Player (HD)';
          if (clean.includes('abyssplayer')) label = 'Abyss (Multi Audio)';
          else if (clean.includes('ravok.buzz')) label = 'Ravok (HD)';
          else if (clean.includes('megaplay.buzz')) label = 'MegaPlay (HD)';
          sources.push({ label, url: clean, isMultiAudio: true });
        }
      }
    });

    const primaryStream = sources.length > 0 ? sources[0].url : '';
    return { streamUrl: primaryStream, sources };
  } catch (e) {
    return { streamUrl: '', sources: [] };
  }
}

function parseEpisodesFromHtml($, seasonNum = 1) {
  const episodes = [];
  $('article.episodes, .episodes article, .post-episode').each((i, el) => {
    const epLinkEl = $(el).find('a.lnk-blk, a').first();
    const epHref = epLinkEl.attr('href') || '';
    const epNumRaw = $(el).find('.num-epi').text().trim();
    const epNum = parseInt(epNumRaw, 10) || i + 1;
    let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
    epTitle = epTitle.replace(/^private:\s*/gi, '').trim();

    const epSlug = epHref.split('/').filter(Boolean).pop() || '';
    let epThumb = $(el).find('figure img, img').first().attr('data-src') ||
                  $(el).find('figure img, img').first().attr('src') || '';
    if (epThumb.startsWith('//')) epThumb = 'https:' + epThumb;

    if (epSlug) {
      episodes.push({
        number: epNum,
        season: seasonNum,
        title: `S${seasonNum} E${epNum}: ${epTitle}`,
        slug: epSlug,
        url: epHref.replace(/^http:\/\//i, 'https://'),
        thumbnail: epThumb
      });
    }
  });
  return episodes;
}

async function scrapeFullSeriesEpisodes(seriesUrl) {
  const allEpisodes = [];
  const html = await fetchHtml(seriesUrl);
  if (!html) return { episodes: [] };
  const $ = cheerio.load(html);

  const seasonButtons = [];
  $('a.season-btn, .season-btn').each((_, el) => {
    const s = $(el).attr('data-season');
    const p = $(el).attr('data-post');
    if (s && p) seasonButtons.push({ season: parseInt(s, 10), post: p });
  });

  if (seasonButtons.length > 0) {
    for (const sb of seasonButtons) {
      try {
        const ajaxUrl = `https://animesalt.cx/wp-admin/admin-ajax.php?action=action_select_season&season=${sb.season}&post=${sb.post}`;
        const ajaxHtml = await fetchHtml(ajaxUrl);
        if (ajaxHtml) {
          const $ajax = cheerio.load(ajaxHtml);
          const sEps = parseEpisodesFromHtml($ajax, sb.season);
          allEpisodes.push(...sEps);
        }
      } catch (err) {}
      await delay(80);
    }
  }

  if (allEpisodes.length === 0) {
    const directEps = parseEpisodesFromHtml($, 1);
    allEpisodes.push(...directEps);
  }

  const uniqueMap = new Map();
  for (const ep of allEpisodes) {
    const key = `${ep.season}-${ep.number}-${ep.slug}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, ep);
  }

  const finalEpisodes = Array.from(uniqueMap.values());
  finalEpisodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });

  return { html, $, episodes: finalEpisodes };
}

async function fetchTMDBArt(query) {
  try {
    const clean = query
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/season \d+/gi, '')
      .replace(/dubbed|dub|sub|hindi|urdu/gi, '')
      .trim();

    const encoded = encodeURIComponent(clean);
    const tvUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=${encoded}`;
    const movUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encoded}`;

    const [tvRes, movRes] = await Promise.all([
      fetch(tvUrl).then(r => r.json()).catch(() => ({ results: [] })),
      fetch(movUrl).then(r => r.json()).catch(() => ({ results: [] }))
    ]);

    const results = [...(tvRes.results || []), ...(movRes.results || [])].filter(x => x && (x.poster_path || x.backdrop_path));
    if (results.length > 0) {
      results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      const best = results[0];
      return {
        poster: best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : '',
        backdrop: best.backdrop_path ? `https://image.tmdb.org/t/p/original${best.backdrop_path}` : '',
        overview: best.overview || '',
        rating: best.vote_average ? Math.round(best.vote_average * 10) / 10 : 8.0,
        year: best.first_air_date ? parseInt(best.first_air_date.split('-')[0], 10) :
              (best.release_date ? parseInt(best.release_date.split('-')[0], 10) : 2024)
      };
    }
  } catch (e) {}
  return null;
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 BACKGROUND SCRAPER STARTED: ANIME, CARTOONS & NEW EPISODES');
  console.log('='.repeat(70));
  const startTime = Date.now();

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Current Database Count: ${db.length} titles.\n`);

  const dbMap = new Map();
  db.forEach((item, idx) => {
    if (item.slug) dbMap.set(item.slug.toLowerCase().trim(), idx);
    if (item.saltSlug) dbMap.set(item.saltSlug.toLowerCase().trim(), idx);
  });

  const candidatesMap = new Map();

  // 1. Scan AnimeSalt Homepage Drops & Recents
  console.log('📡 [1/4] Scanning AnimeSalt homepage drops...');
  const homeHtml = await fetchHtml('https://animesalt.cx/');
  if (homeHtml) {
    const $h = cheerio.load(homeHtml);
    $h('article').each((_, el) => {
      const a = $h(el).find('a.lnk-blk, a').first();
      const href = a.attr('href') || '';
      const title = $h(el).find('.entry-title, .title, h2, h3').first().text().trim() ||
                    $h(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();

      if (href.includes('/series/') || href.includes('/movies/')) {
        const cleanUrl = href.replace(/^http:\/\//i, 'https://');
        const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
        const type = href.includes('/movies/') ? 'movie' : 'series';
        if (slug && !candidatesMap.has(slug)) {
          candidatesMap.set(slug, { title: title || slug, url: cleanUrl, slug, type, source: 'Homepage' });
        }
      }
    });
  }

  // 2. Scan AnimeSalt /series/ (Pages 1 to 6)
  console.log('📡 [2/4] Scanning AnimeSalt /series/ pages 1 to 6...');
  for (let p = 1; p <= 6; p++) {
    const pUrl = p === 1 ? 'https://animesalt.cx/series/' : `https://animesalt.cx/series/page/${p}/`;
    const pHtml = await fetchHtml(pUrl);
    if (!pHtml) continue;
    const $p = cheerio.load(pHtml);
    $p('article').each((_, el) => {
      const a = $p(el).find('a').first();
      const href = a.attr('href') || '';
      const title = $p(el).find('.entry-title, .title, h2, h3').first().text().trim() ||
                    $p(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();
      if (href.includes('/series/')) {
        const cleanUrl = href.replace(/^http:\/\//i, 'https://');
        const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
        if (slug && !candidatesMap.has(slug)) {
          candidatesMap.set(slug, { title: title || slug, url: cleanUrl, slug, type: 'series', source: 'Series Catalog' });
        }
      }
    });
    await delay(100);
  }

  // 3. Scan AnimeSalt Cartoons & Kids Categories
  console.log('📡 [3/4] Scanning AnimeSalt Cartoon & Kids categories...');
  const cartoonCategories = [
    'https://animesalt.cx/category/cartoon/',
    'https://animesalt.cx/category/kids/',
    'https://animesalt.cx/category/animation/'
  ];
  for (const catUrl of cartoonCategories) {
    const cHtml = await fetchHtml(catUrl);
    if (!cHtml) continue;
    const $c = cheerio.load(cHtml);
    $c('article, .item').each((_, el) => {
      const a = $c(el).find('a.lnk-blk, a').first();
      const href = a.attr('href') || '';
      const title = $c(el).find('.entry-title, .title, h2, h3').first().text().trim() ||
                    $c(el).find('img').attr('alt')?.replace(/^Image\s+/i, '').trim();
      if (href.includes('/series/') || href.includes('/movies/')) {
        const cleanUrl = href.replace(/^http:\/\//i, 'https://');
        const slug = cleanUrl.split('/').filter(Boolean).pop().toLowerCase();
        const type = href.includes('/movies/') ? 'movie' : 'series';
        if (slug && !candidatesMap.has(slug)) {
          candidatesMap.set(slug, { title: title || slug, url: cleanUrl, slug, type, source: 'Cartoons' });
        }
      }
    });
    await delay(100);
  }

  // 4. Scan ToonStream Latest Releases
  console.log('📡 [4/4] Scanning ToonStream latest releases & anime/cartoon categories...');
  const toonUrls = [
    'https://toon-stream.site/',
    'https://toon-stream.site/category/cartoon?type=all&page=1',
    'https://toon-stream.site/category/anime?type=all&page=1'
  ];
  for (const tUrl of toonUrls) {
    const tHtml = await fetchHtml(tUrl);
    if (!tHtml) continue;
    const $t = cheerio.load(tHtml);
    $t('article, .item, .post').each((_, el) => {
      const a = $t(el).find('a').first();
      const href = a.attr('href') || '';
      const title = $t(el).find('h2, h3, .title, .entry-title').first().text().trim() ||
                    $t(el).find('img').attr('alt')?.trim();
      if (href.includes('/series/') || href.includes('/movies/')) {
        const slug = href.split('/').filter(Boolean).pop().toLowerCase();
        const type = href.includes('/movies/') ? 'movie' : 'series';
        if (slug && !candidatesMap.has(slug)) {
          candidatesMap.set(slug, { title: title || slug, url: href, slug, type, source: 'ToonStream' });
        }
      }
    });
    await delay(100);
  }

  const candidates = Array.from(candidatesMap.values());
  console.log(`\nFound ${candidates.length} unique titles across AnimeSalt & ToonStream to process.\n`);

  let newTitlesAdded = 0;
  let existingUpdated = 0;
  let totalNewEpisodes = 0;
  const brandNewItems = [];

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const dbIdx = dbMap.get(c.slug);

    if (dbIdx === undefined) {
      // ----------------- BRAND NEW TITLE -----------------
      console.log(`\n[${i + 1}/${candidates.length}] [NEW TITLE FOUND] "${c.title}" (${c.slug}) [${c.type}]`);
      try {
        if (c.type === 'movie') {
          // Movie scraping
          const html = await fetchHtml(c.url);
          const $ = html ? cheerio.load(html) : null;
          const title = $ ? ($('h1').first().text().trim() || c.title) : c.title;
          const description = $ ? ($('.entry-content p, .synopsis p, .description p').first().text().trim() || '') : '';

          const [tmdbArt] = await Promise.all([fetchTMDBArt(title)]);
          const poster = tmdbArt?.poster || ($ ? $('img[data-src*="image.tmdb.org"], .post-thumbnail img').first().attr('data-src') || '' : '');
          const backdrop = tmdbArt?.backdrop || ($ ? $('.TPostBg').first().attr('data-src') || poster : poster);

          const { streamUrl, sources } = await fetchEpisodeStreams(c.url);

          const newMovie = {
            title,
            slug: c.slug,
            saltSlug: c.url.includes('animesalt') ? c.slug : undefined,
            toonSlug: c.url.includes('toon') ? c.slug : undefined,
            url: c.url,
            type: 'movie',
            poster,
            backdrop,
            description: tmdbArt?.overview || description,
            genres: ['Animation', 'Anime', 'Adventure'],
            audioLanguages: ['Hindi', 'Urdu', 'Japanese'],
            rating: tmdbArt?.rating || 8.0,
            year: tmdbArt?.year || 2024,
            episodeCount: 1,
            episodesCount: 1,
            streamUrl,
            streamSources: sources,
            source: c.url.includes('toon') ? 'toonstream' : 'animesalt'
          };

          brandNewItems.push(newMovie);
          dbMap.set(c.slug, 0);
          newTitlesAdded++;
          console.log(`  ✓ Successfully added brand new Movie "${title}"!`);
        } else {
          // Series scraping
          const { html, $, episodes } = await scrapeFullSeriesEpisodes(c.url);
          const title = $ ? ($('h1').first().text().trim() || c.title) : c.title;
          const description = $ ? ($('.entry-content p, .synopsis p').first().text().trim() || '') : '';

          const [tmdbArt] = await Promise.all([fetchTMDBArt(title)]);
          const poster = tmdbArt?.poster || ($ ? $('img[data-src*="image.tmdb.org"], .post-thumbnail img').first().attr('data-src') || '' : '');
          const backdrop = tmdbArt?.backdrop || ($ ? $('.TPostBg').first().attr('data-src') || poster : poster);

          console.log(`  Scraping streams for ${episodes.length} episodes...`);
          for (const ep of episodes) {
            if (ep.url) {
              const { streamUrl, sources } = await fetchEpisodeStreams(ep.url);
              if (streamUrl) ep.streamUrl = streamUrl;
              if (sources.length > 0) ep.streamSources = sources;
            }
          }

          const newSeries = {
            title,
            slug: c.slug,
            saltSlug: c.url.includes('animesalt') ? c.slug : undefined,
            toonSlug: c.url.includes('toon') ? c.slug : undefined,
            url: c.url,
            type: 'series',
            poster,
            backdrop,
            description: tmdbArt?.overview || description,
            genres: ['Animation', 'Anime', 'Adventure'],
            audioLanguages: ['Hindi', 'Urdu', 'Japanese'],
            rating: tmdbArt?.rating || 8.0,
            year: tmdbArt?.year || 2024,
            episodes,
            episodeCount: episodes.length,
            episodesCount: episodes.length,
            source: c.url.includes('toon') ? 'toonstream' : 'animesalt'
          };

          brandNewItems.push(newSeries);
          dbMap.set(c.slug, 0);
          newTitlesAdded++;
          totalNewEpisodes += episodes.length;
          console.log(`  ✓ Successfully added brand new Series "${title}" with ${episodes.length} episodes!`);
        }
      } catch (err) {
        console.error(`  ✗ Error scraping "${c.title}":`, err.message);
      }
    } else {
      // ----------------- EXISTING TITLE: CHECK FOR NEW EPISODES -----------------
      const dbItem = db[dbIdx];
      if (dbItem.type === 'series') {
        const previousCount = dbItem.episodes ? dbItem.episodes.length : 0;
        const targetUrl = dbItem.saltUrl || dbItem.url || c.url;

        try {
          const { episodes } = await scrapeFullSeriesEpisodes(targetUrl);
          if (episodes.length > previousCount) {
            const diff = episodes.length - previousCount;
            console.log(`\n[EPISODE UPDATE] "${dbItem.title}" has ${episodes.length} episodes (DB had ${previousCount}) -> (+${diff} new episodes!)`);

            const existingMap = new Map();
            if (dbItem.episodes) {
              for (const ep of dbItem.episodes) {
                existingMap.set(`${ep.season || 1}-${ep.number}`, ep);
                existingMap.set(ep.slug, ep);
              }
            }

            const merged = [];
            for (const newEp of episodes) {
              const key = `${newEp.season || 1}-${newEp.number}`;
              const existingEp = existingMap.get(key) || existingMap.get(newEp.slug);

              if (existingEp) {
                if (!existingEp.saltUrl && newEp.url) existingEp.saltUrl = newEp.url;
                if (!existingEp.thumbnail && newEp.thumbnail) existingEp.thumbnail = newEp.thumbnail;
                merged.push(existingEp);
              } else {
                console.log(`  -> Scraping stream for new Episode: ${newEp.title}`);
                const { streamUrl, sources } = await fetchEpisodeStreams(newEp.url);
                if (streamUrl) newEp.streamUrl = streamUrl;
                if (sources.length > 0) newEp.streamSources = sources;
                merged.push(newEp);
              }
            }

            dbItem.episodes = merged;
            dbItem.episodeCount = merged.length;
            dbItem.episodesCount = merged.length;
            existingUpdated++;
            totalNewEpisodes += diff;
            console.log(`  ✓ Updated "${dbItem.title}" to ${merged.length} episodes.`);
          }
        } catch (err) {}
      }
    }

    await delay(100);
  }

  // Prepend brand new items to DB
  if (brandNewItems.length > 0) {
    db.unshift(...brandNewItems);
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ SCRAPE COMPLETE');
  console.log(`- New Anime & Cartoon Titles Added: ${newTitlesAdded}`);
  console.log(`- Existing Series Updated: ${existingUpdated}`);
  console.log(`- Total New Episodes Ingested: ${totalNewEpisodes}`);
  console.log(`- Total Titles in Database: ${db.length}`);
  console.log(`- Total Elapsed Time: ${Math.round((Date.now() - startTime) / 1000)}s`);
  console.log('='.repeat(70) + '\n');

  // Save anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`💾 Saved updated ${DB_PATH}`);

  // Regenerate anime-catalog.json preserving all flags
  console.log('🔄 Regenerating anime-catalog.json with full metadata...');
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
    hasStreams: true,
    anilist: item.anilist || null,
    source: item.source || 'hybrid',
    isCustomLocal: item.isCustomLocal ?? false,
    isFeaturedHero: item.isFeaturedHero ?? false,
    heroRank: item.heroRank || undefined
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Saved anime-catalog.json (${catalog.length} items).`);
  console.log('🎉 ALL DONE! ALL NEW ANIME, CARTOONS & EPISODES ARE NOW SYNCED IN LOCAL APP!');
}

main().catch(console.error);
