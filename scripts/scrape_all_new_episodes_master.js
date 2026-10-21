/**
 * scripts/scrape_all_new_episodes_master.js
 *
 * Master Episode Scraper for AnimePakistan:
 * - Scrapes AnimeSalt (sitemaps, homepage, /series/) and ToonStream (fresh drops, categories).
 * - Identifies all series with newly released episodes or missing episodes.
 * - Extracts all episode metadata (number, season, title, slug, thumbnail).
 * - Extracts working stream embeds (Abyss multi-audio, VidStreaming, Ravok, MegaPlay, etc.).
 * - Updates anime-db.json and regenerates anime-catalog.json.
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

async function fetchHtml(url, retries = 3, timeoutMs = 10000) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { ...HEADERS, 'Referer': url }, signal: controller.signal });
      clearTimeout(id);
      if (res.status === 404) return null;
      if (res.ok) return await res.text();
      await delay(400 * attempt);
    } catch (e) {
      clearTimeout(id);
      if (attempt === retries) return null;
      await delay(400 * attempt);
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
  if (!url || typeof url !== 'string' || !url.includes('data=')) return [];
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
    const html = await fetchHtml(epUrl, 2, 7000);
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
          let label = 'Server HD';
          if (clean.includes('abyssplayer')) label = 'Abyss (Multi Audio)';
          else if (clean.includes('vidstreaming')) label = 'VidStreaming (HD)';
          else if (clean.includes('ravok.buzz')) label = 'Ravok (HD)';
          else if (clean.includes('megaplay.buzz')) label = 'MegaPlay (HD)';
          else if (clean.includes('as-cdn')) label = 'AnimeSalt CDN';
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

function parseEpisodesFromHtml($, seasonNum = 1, baseUrl = 'https://animesalt.cx') {
  const episodes = [];
  $('article.episodes, .episodes article, .post-episode').each((i, el) => {
    const epLinkEl = $(el).find('a.lnk-blk, a').first();
    let epHref = epLinkEl.attr('href') || '';
    if (epHref.startsWith('/')) {
      epHref = baseUrl + epHref;
    }
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
  const isToon = seriesUrl.includes('toon');
  const baseUrl = isToon ? 'https://toon-stream.site' : 'https://animesalt.cx';

  const seasonButtons = [];
  $('a.season-btn, .season-btn, [data-season]').each((_, el) => {
    const s = $(el).attr('data-season');
    const p = $(el).attr('data-post');
    if (s) seasonButtons.push({ season: parseInt(s, 10) || 1, post: p });
  });

  if (seasonButtons.length > 0 && !isToon) {
    for (const sb of seasonButtons) {
      if (sb.post) {
        try {
          const ajaxUrl = `https://animesalt.cx/wp-admin/admin-ajax.php?action=action_select_season&season=${sb.season}&post=${sb.post}`;
          const ajaxHtml = await fetchHtml(ajaxUrl);
          if (ajaxHtml) {
            const $ajax = cheerio.load(ajaxHtml);
            const sEps = parseEpisodesFromHtml($ajax, sb.season, baseUrl);
            allEpisodes.push(...sEps);
          }
        } catch (err) {}
        await delay(50);
      }
    }
  }

  // Also parse direct episodes on page
  const directEps = parseEpisodesFromHtml($, 1, baseUrl);
  allEpisodes.push(...directEps);

  const uniqueMap = new Map();
  for (const ep of allEpisodes) {
    const key = `${ep.season || 1}-${ep.number}-${ep.slug}`;
    if (!uniqueMap.has(key)) uniqueMap.set(key, ep);
  }

  const finalEpisodes = Array.from(uniqueMap.values());
  finalEpisodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });

  return { html, $, episodes: finalEpisodes };
}

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 MASTER EPISODE SCRAPER: ALL NEW ANIME EPISODES');
  console.log('='.repeat(70));
  const startTime = Date.now();

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Loaded database with ${db.length} items.`);

  // Clean corrupted slugs if any
  db.forEach(item => {
    if (item.slug && item.slug.includes(':')) {
      item.slug = item.slug.replace(/:/g, '');
    }
  });

  // Build lookup index
  const dbIndex = new Map();
  db.forEach((item, idx) => {
    if (item.slug) dbIndex.set(item.slug.toLowerCase().trim(), idx);
    if (item.saltSlug) dbIndex.set(item.saltSlug.toLowerCase().trim(), idx);
    if (item.toonSlug) dbIndex.set(item.toonSlug.toLowerCase().trim(), idx);
    dbIndex.set(normalize(item.title), idx);
  });

  // STEP 1: Fix all 0-episode or low-episode series in DB first
  console.log('\n🔍 [STEP 1] Checking existing series in DB with 0 or few episodes...');
  let existingFixed = 0;
  let totalNewEps = 0;

  for (let i = 0; i < db.length; i++) {
    const item = db[i];
    if (item.type !== 'series') continue;

    const curCount = item.episodes ? item.episodes.length : 0;
    // If it has 0 episodes or less than 5 episodes, check if full seasons exist
    if (curCount < 5) {
      const candidates = [];
      if (item.saltUrl) candidates.push(item.saltUrl);
      if (item.url && item.url.startsWith('http')) candidates.push(item.url);
      if (item.saltSlug) candidates.push(`https://animesalt.cx/series/${item.saltSlug}/`);
      if (item.slug) {
        candidates.push(`https://animesalt.cx/series/${item.slug}/`);
        candidates.push(`https://toon-stream.site/series/${item.slug}`);
      }
      if (item.toonSlug) candidates.push(`https://toon-stream.site/series/${item.toonSlug}`);

      for (const testUrl of candidates) {
        const { episodes } = await scrapeFullSeriesEpisodes(testUrl);
        if (episodes.length > curCount) {
          console.log(`✨ Found ${episodes.length} episodes for "${item.title}" via ${testUrl} (DB had ${curCount})`);
          
          // Scrape streams for new episodes with concurrency
          for (let epIdx = 0; epIdx < episodes.length; epIdx++) {
            const ep = episodes[epIdx];
            if (!ep.streamUrl && ep.url) {
              const { streamUrl, sources } = await fetchEpisodeStreams(ep.url);
              if (streamUrl) ep.streamUrl = streamUrl;
              if (sources.length > 0) ep.streamSources = sources;
            }
          }

          item.episodes = episodes;
          item.episodeCount = episodes.length;
          item.episodesCount = episodes.length;
          existingFixed++;
          totalNewEps += (episodes.length - curCount);
          break;
        }
      }
    }
  }
  console.log(`✅ Fixed ${existingFixed} series that had missing episodes (+${totalNewEps} episodes).`);

  // STEP 2: Scan AnimeSalt Sitemaps & Homepage for newly released series/episodes
  console.log('\n🔍 [STEP 2] Scanning AnimeSalt series sitemaps for newly dropped episodes...');
  const sitemapRes = await fetchHtml('https://animesalt.cx/series-sitemap1.xml');
  const sitemapUrls = [];
  if (sitemapRes) {
    const matches = sitemapRes.match(/<loc>(.*?)<\/loc>/g) || [];
    for (const m of matches) {
      const u = m.replace(/<\/?loc>/g, '');
      if (u.includes('/series/') && !u.endsWith('/series/')) {
        sitemapUrls.push(u);
      }
    }
  }
  console.log(`Found ${sitemapUrls.length} series in AnimeSalt sitemap1.`);

  // Check top 60 most recent series on AnimeSalt
  const checkLimit = Math.min(sitemapUrls.length, 60);
  for (let i = 0; i < checkLimit; i++) {
    const sUrl = sitemapUrls[i];
    const slug = sUrl.split('/').filter(Boolean).pop().toLowerCase();
    const idx = dbIndex.get(slug) ?? dbIndex.get(normalize(slug));

    if (idx !== undefined) {
      const item = db[idx];
      const curCount = item.episodes ? item.episodes.length : 0;
      const { episodes } = await scrapeFullSeriesEpisodes(sUrl);

      if (episodes.length > curCount) {
        const diff = episodes.length - curCount;
        console.log(`\n🔥 [NEW EPISODES] "${item.title}" on AnimeSalt: has ${episodes.length} eps (DB had ${curCount}) -> (+${diff} new)`);

        const existingMap = new Map();
        if (item.episodes) {
          item.episodes.forEach(e => {
            existingMap.set(`${e.season || 1}-${e.number}`, e);
            existingMap.set(e.slug, e);
          });
        }

        const merged = [];
        for (const newEp of episodes) {
          const key = `${newEp.season || 1}-${newEp.number}`;
          const existing = existingMap.get(key) || existingMap.get(newEp.slug);
          if (existing) {
            if (!existing.saltUrl && newEp.url) existing.saltUrl = newEp.url;
            if (!existing.thumbnail && newEp.thumbnail) existing.thumbnail = newEp.thumbnail;
            merged.push(existing);
          } else {
            console.log(`  -> Scraping stream for new Episode: ${newEp.title}`);
            const { streamUrl, sources } = await fetchEpisodeStreams(newEp.url);
            if (streamUrl) newEp.streamUrl = streamUrl;
            if (sources.length > 0) newEp.streamSources = sources;
            merged.push(newEp);
          }
        }

        item.episodes = merged;
        item.episodeCount = merged.length;
        item.episodesCount = merged.length;
        totalNewEps += diff;
      }
    }
    await delay(60);
  }

  // STEP 3: Scan ToonStream Category Anime & Fresh Drops
  console.log('\n🔍 [STEP 3] Scanning ToonStream latest anime for new drops...');
  const toonAnimePages = [
    'https://toon-stream.site/category/anime?type=all&page=1',
    'https://toon-stream.site/category/anime?type=all&page=2'
  ];

  for (const pageUrl of toonAnimePages) {
    const html = await fetchHtml(pageUrl);
    if (!html) continue;
    const $ = cheerio.load(html);

    const toonCards = [];
    $('article, .item, .post').each((_, el) => {
      const a = $(el).find('a').first();
      let href = a.attr('href') || '';
      if (!href.includes('/series/')) return;
      if (href.startsWith('/')) href = 'https://toon-stream.site' + href;
      const title = $(el).find('h2, h3, .title, .entry-title').first().text().trim();
      const slug = href.split('/').filter(Boolean).pop().toLowerCase();
      if (slug && !toonCards.some(t => t.slug === slug)) {
        toonCards.push({ title, url: href, slug });
      }
    });

    for (const card of toonCards) {
      const idx = dbIndex.get(card.slug) ?? dbIndex.get(normalize(card.title));
      if (idx !== undefined) {
        const item = db[idx];
        const curCount = item.episodes ? item.episodes.length : 0;
        const { episodes } = await scrapeFullSeriesEpisodes(card.url);

        if (episodes.length > curCount) {
          const diff = episodes.length - curCount;
          console.log(`\n🔥 [TOONSTREAM NEW EPS] "${item.title}": has ${episodes.length} eps (DB had ${curCount}) -> (+${diff} new)`);

          const existingMap = new Map();
          if (item.episodes) {
            item.episodes.forEach(e => {
              existingMap.set(`${e.season || 1}-${e.number}`, e);
              existingMap.set(e.slug, e);
            });
          }

          const merged = [];
          for (const newEp of episodes) {
            const key = `${newEp.season || 1}-${newEp.number}`;
            const existing = existingMap.get(key) || existingMap.get(newEp.slug);
            if (existing) {
              if (!existing.toonUrl && newEp.url) existing.toonUrl = newEp.url;
              merged.push(existing);
            } else {
              console.log(`  -> Scraping stream for new Episode: ${newEp.title}`);
              const { streamUrl, sources } = await fetchEpisodeStreams(newEp.url);
              if (streamUrl) newEp.streamUrl = streamUrl;
              if (sources.length > 0) newEp.streamSources = sources;
              merged.push(newEp);
            }
          }

          item.episodes = merged;
          item.episodeCount = merged.length;
          item.episodesCount = merged.length;
          totalNewEps += diff;
        }
      }
      await delay(60);
    }
  }

  // STEP 4: Save anime-db.json and regenerate anime-catalog.json
  console.log('\n💾 Saving updated anime-db.json...');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  console.log('🔄 Regenerating anime-catalog.json...');
  const catalog = db.map(item => {
    const hasStreams = Boolean(
      item.streamUrl ||
      item.driveUrl ||
      item.toonStreamUrl ||
      (item.episodes && item.episodes.some(ep => ep.streamUrl || ep.driveUrl || ep.toonStreamUrl))
    );

    return {
      title: item.title,
      slug: item.slug,
      type: item.type || (item.episodes && item.episodes.length > 0 ? 'series' : 'movie'),
      poster: item.poster || item.image || '',
      backdrop: item.backdrop || item.heroBackdrop || item.poster || '',
      description: item.description || item.synopsis || '',
      genres: item.genres || ['Anime'],
      audioLanguages: item.audioLanguages || ['Hindi', 'Urdu', 'Japanese'],
      rating: item.rating || 8.0,
      year: item.year || 2024,
      episodeCount: item.episodes ? item.episodes.length : (item.episodeCount || 1),
      episodesCount: item.episodes ? item.episodes.length : (item.episodesCount || 1),
      hasStreams,
      heroRanking: item.heroRanking || undefined,
      source: item.source || 'animesalt',
      anilist: item.anilist || undefined,
      episodes: item.episodes ? item.episodes.map(ep => ({
        number: ep.number,
        season: ep.season || 1,
        title: ep.title,
        slug: ep.slug,
        thumbnail: ep.thumbnail || '',
        streamUrl: ep.streamUrl || ep.driveUrl || ep.toonStreamUrl || '',
        streamSources: ep.streamSources || []
      })) : undefined
    };
  });

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Saved ${CATALOG_PATH} with ${catalog.length} items.`);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log('\n' + '='.repeat(70));
  console.log('🎉 SCRAPE FINISHED SUCCESSFULLY!');
  console.log(`- Total New Episodes Ingested: ${totalNewEps}`);
  console.log(`- Total Titles in Database: ${db.length}`);
  console.log(`- Elapsed Time: ${elapsed}s`);
  console.log('='.repeat(70) + '\n');
}

main().catch(err => {
  console.error('Fatal scrape error:', err);
  process.exit(1);
});
