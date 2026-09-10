/**
 * scripts/scrape_all_new_episodes.js
 *
 * Scrapes newly released episodes for active anime series from AnimeSalt,
 * preserves existing stream data, updates anime-db.json, and regenerates anime-catalog.json.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithUA(url, retries = 3, timeoutMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://animesalt.cx/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) throw err;
      await delay(1000 * attempt);
    }
  }
}

function parseEpisodesFromHtml($, seasonNum = 1) {
  const episodes = [];
  $('article.episodes').each((i, el) => {
    const epLinkEl = $(el).find('a.lnk-blk').first();
    const epHref = epLinkEl.attr('href') || '';
    const epNumRaw = $(el).find('.num-epi').text().trim();
    const epNum = parseInt(epNumRaw, 10) || i + 1;
    let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
    epTitle = epTitle.replace(/^private:\s*/gi, '').trim();

    const epSlug = epHref.split('/').filter(Boolean).pop() || '';
    let epThumb = $(el).find('figure img, img').first().attr('data-src') ||
                  $(el).find('figure img, img').first().attr('src') || '';
    if (epThumb.startsWith('//')) {
      epThumb = 'https:' + epThumb;
    }

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
  const html = await fetchWithUA(seriesUrl);
  const $ = cheerio.load(html);

  // Check for season buttons
  const seasonButtons = [];
  $('a.season-btn, .season-btn').each((_, el) => {
    const s = $(el).attr('data-season');
    const p = $(el).attr('data-post');
    if (s && p) {
      seasonButtons.push({ season: parseInt(s, 10), post: p });
    }
  });

  if (seasonButtons.length > 0) {
    for (const sb of seasonButtons) {
      try {
        const ajaxUrl = `https://animesalt.cx/wp-admin/admin-ajax.php?action=action_select_season&season=${sb.season}&post=${sb.post}`;
        const ajaxHtml = await fetchWithUA(ajaxUrl);
        const $ajax = cheerio.load(ajaxHtml);
        const sEps = parseEpisodesFromHtml($ajax, sb.season);
        if (sEps.length > 0) {
          allEpisodes.push(...sEps);
        }
      } catch (err) {
        console.warn(`  [!] Failed AJAX for season ${sb.season}:`, err.message);
      }
      await delay(200);
    }
  }

  // Fallback to direct HTML if no season buttons or AJAX yielded nothing
  if (allEpisodes.length === 0) {
    const directEps = parseEpisodesFromHtml($, 1);
    allEpisodes.push(...directEps);
  }

  // Deduplicate and sort by season, then episode number
  const uniqueEpsMap = new Map();
  for (const ep of allEpisodes) {
    const key = `${ep.season}-${ep.number}-${ep.slug}`;
    if (!uniqueEpsMap.has(key)) {
      uniqueEpsMap.set(key, ep);
    }
  }

  const finalEpisodes = Array.from(uniqueEpsMap.values());
  finalEpisodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });

  return { html, $, episodes: finalEpisodes };
}

async function main() {
  console.log('=== SCRAPING & SYNCING NEW EPISODES FOR ANIMESALT SERIES ===\n');

  if (!fs.existsSync(DB_PATH)) {
    console.error('Database file not found at:', DB_PATH);
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Loaded database with ${db.length} entries.`);

  // List of series identified with newly released episodes
  const seriesToUpdate = [
    { title: 'BLACK TORCH', slug: 'black-torch', url: 'https://animesalt.cx/series/black-torch/' },
    { title: 'Jaadugar: A Witch in Mongolia', slug: 'jaadugar-a-witch-in-mongolia', url: 'https://animesalt.cx/series/jaadugar-a-witch-in-mongolia/' },
    { title: 'Cinderella Chef', slug: 'cinderella-chef', url: 'https://animesalt.cx/series/cinderella-chef/' },
    { title: 'Grand Blue Dreaming', slug: 'grand-blue-dreaming', url: 'https://animesalt.cx/series/grand-blue-dreaming/' },
    { title: 'Hanaori-san Still Wants to Fight in the Next Life', slug: 'hanaori-san-still-wants-to-fight-in-the-next-life', url: 'https://animesalt.cx/series/hanaori-san-still-wants-to-fight-in-the-next-life/' },
    { title: 'I Became a Legend After My 10 Year-Long Last Stand', slug: 'i-became-a-legend-after-my-10-year-long-last-stand', url: 'https://animesalt.cx/series/i-became-a-legend-after-my-10-year-long-last-stand/' },
    { title: 'Chainsmoker Cat', slug: 'chainsmoker-cat', url: 'https://animesalt.cx/series/chainsmoker-cat/' },
    { title: 'Tomb Raider King', slug: 'tomb-raider-king', url: 'https://animesalt.cx/series/tomb-raider-king/' },
    { title: 'Smoking Behind the Supermarket with You', slug: 'smoking-behind-the-supermarket-with-you', url: 'https://animesalt.cx/series/smoking-behind-the-supermarket-with-you/' },
    { title: 'Thunder 3', slug: 'thunder-3', url: 'https://animesalt.cx/series/thunder-3/' },
    { title: 'Sparks of Tomorrow', slug: 'sparks-of-tomorrow', url: 'https://animesalt.cx/series/sparks-of-tomorrow/' },
    { title: 'Yowayowa Sensei', slug: 'yowayowa-sensei', url: 'https://animesalt.cx/series/yowayowa-sensei/' },
    { title: "Tamon's B-Side", slug: 'tamons-b-side', url: 'https://animesalt.cx/series/tamons-b-side/' },
    { title: 'LIAR GAME', slug: 'liar-game', url: 'https://animesalt.cx/series/liar-game/' },
    { title: 'Daemons of the Shadow Realm', slug: 'daemons-of-the-shadow-realm', url: 'https://animesalt.cx/series/daemons-of-the-shadow-realm/' }
  ];

  let totalNewEpisodesAdded = 0;
  let updatedSeriesCount = 0;

  for (let i = 0; i < seriesToUpdate.length; i++) {
    const target = seriesToUpdate[i];
    console.log(`\n[${i + 1}/${seriesToUpdate.length}] Processing "${target.title}"...`);

    const dbItem = db.find(x =>
      (x.slug && x.slug.toLowerCase().trim() === target.slug.toLowerCase().trim()) ||
      (x.saltSlug && x.saltSlug.toLowerCase().trim() === target.slug.toLowerCase().trim())
    );

    if (!dbItem) {
      console.warn(`  [!] Could not locate "${target.title}" in DB.`);
      continue;
    }

    const previousCount = dbItem.episodes ? dbItem.episodes.length : 0;

    try {
      const { episodes } = await scrapeFullSeriesEpisodes(target.url);
      console.log(`  Scraped ${episodes.length} total episodes from source (DB had ${previousCount}).`);

      if (episodes.length > previousCount) {
        // Map existing episode streams if any were pre-cached
        const existingStreamMap = new Map();
        if (dbItem.episodes) {
          for (const oldEp of dbItem.episodes) {
            if (oldEp.streamUrl) {
              existingStreamMap.set(oldEp.slug, oldEp.streamUrl);
              existingStreamMap.set(`${oldEp.season}-${oldEp.number}`, oldEp.streamUrl);
            }
          }
        }

        // Apply preserved streamUrls to the fresh episode list
        for (const newEp of episodes) {
          const preserved = existingStreamMap.get(newEp.slug) || existingStreamMap.get(`${newEp.season}-${newEp.number}`);
          if (preserved && !newEp.streamUrl) {
            newEp.streamUrl = preserved;
          }
        }

        const diff = episodes.length - previousCount;
        dbItem.episodes = episodes;
        totalNewEpisodesAdded += diff;
        updatedSeriesCount++;

        console.log(`  ✓ Updated "${target.title}": ${previousCount} -> ${episodes.length} episodes (+${diff} new)`);
      } else {
        console.log(`  - "${target.title}" episode count already current (${previousCount}).`);
      }
    } catch (err) {
      console.error(`  ✗ Failed scraping "${target.title}":`, err.message);
    }

    await delay(300);
  }

  console.log(`\n========================================`);
  console.log(`Scrape Summary:`);
  console.log(`- Updated Series: ${updatedSeriesCount}`);
  console.log(`- New Episodes Added: ${totalNewEpisodesAdded}`);
  console.log(`========================================\n`);

  // Save anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`💾 Saved updated ${DB_PATH} (${db.length} items)`);

  // Regenerate anime-catalog.json
  console.log('Regenerating anime-catalog.json...');
  const catalog = db.map(item => ({
    id: item.id || item.slug,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || item.slug,
    type: item.type || 'series',
    poster: item.poster || '',
    backdrop: item.backdrop || item.poster || '',
    genres: item.genres || ['Anime'],
    rating: item.rating || 8.0,
    year: item.year || 2023,
    episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    source: item.source || 'animesalt'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`💾 Regenerated anime-catalog.json (${catalog.length} items)`);

  console.log('\n🎉 ALL NEW EPISODES SUCCESSFULLY SYNCED!');
}

main().catch(console.error);
