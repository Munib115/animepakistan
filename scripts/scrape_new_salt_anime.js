/**
 * scripts/scrape_new_salt_anime.js
 *
 * Scrapes new anime and new episodes from animesalt.cx,
 * enriches metadata with TMDB and AniList, and merges them into anime-db.json.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const TMDB_KEY = process.env.TMDB_API_KEY || '119b065ce02f9f479565d6b99a758ee2';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithUA(url, timeoutMs = 15000) {
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
    return res.text();
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function fetchTMDBArt(query, type) {
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
        rating: best.vote_average ? Math.round(best.vote_average * 10) : null
      };
    }
  } catch (e) {}
  return null;
}

async function fetchAnilistMetadata(title) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description
        averageScore
        seasonYear
        season
        status
        genres
      }
    }
  `;

  try {
    const searchClean = title
      .replace(/\(.*\)/g, '')
      .replace(/\[.*\]/g, '')
      .replace(/season \d+/gi, '')
      .replace(/dubbed|dub|sub|hindi|urdu/gi, '')
      .trim();

    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: searchClean || title }
      })
    });

    if (res.ok) {
      const json = await res.json();
      const media = json.data?.Media;
      if (media) {
        return {
          id: media.id,
          romajiName: media.title?.romaji || '',
          englishName: media.title?.english || '',
          nativeName: media.title?.native || '',
          description: media.description || '',
          coverImage: media.coverImage?.extraLarge || media.coverImage?.large || '',
          bannerImage: media.bannerImage || '',
          rating: media.averageScore || null,
          year: media.seasonYear || null,
          season: media.season || '',
          status: media.status || '',
          genres: media.genres || []
        };
      }
    }
  } catch (e) {}
  return null;
}

function parseEpisodesFromHtml($, seasonNum = 1) {
  const episodes = [];
  $('article.episodes').each((i, el) => {
    const epLinkEl = $(el).find('a.lnk-blk').first();
    const epHref = epLinkEl.attr('href') || '';
    const epNum = $(el).find('.num-epi').text().trim();
    let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
    epTitle = epTitle.replace(/^private:\s*/gi, '').trim();
    const epSlug = epHref.split('/').filter(Boolean).pop() || '';
    let epThumb = $(el).find('figure img, img').first().attr('data-src') || $(el).find('figure img, img').first().attr('src') || '';
    if (epThumb.startsWith('//')) {
      epThumb = 'https:' + epThumb;
    }

    if (epSlug) {
      episodes.push({
        number: parseInt(epNum, 10) || i + 1,
        season: seasonNum,
        title: `S${seasonNum} E${parseInt(epNum, 10) || i + 1}: ${epTitle}`,
        slug: epSlug,
        url: epHref.replace(/^http:\/\//i, 'https://'),
        thumbnail: epThumb
      });
    }
  });

  return episodes;
}

async function scrapeFullSeriesEpisodes(seriesUrl, defaultPostId) {
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

  // If no season buttons or ajax returned 0, fallback to direct HTML episodes
  if (allEpisodes.length === 0) {
    const directEps = parseEpisodesFromHtml($, 1);
    allEpisodes.push(...directEps);
  }

  // Sort episodes by season ascending, then number ascending
  allEpisodes.sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season;
    return a.number - b.number;
  });

  return { html, $, episodes: allEpisodes };
}

async function main() {
  console.log('=== SCRAPING NEW ANIME & EPISODES FROM ANIMESALT.CX ===\n');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const dbMap = new Map(db.map((x, idx) => [x.slug.toLowerCase().trim(), idx]));

  // 1. Scrape the 4 brand new series
  const newSeriesTargets = [
    {
      title: 'Boruto: Naruto Next Generations',
      slug: 'boruto-naruto-next-generations',
      url: 'https://animesalt.cx/series/boruto-naruto-next-generations/'
    },
    {
      title: 'BLACK TORCH',
      slug: 'black-torch',
      url: 'https://animesalt.cx/series/black-torch/'
    },
    {
      title: 'Jaadugar: A Witch in Mongolia',
      slug: 'jaadugar-a-witch-in-mongolia',
      url: 'https://animesalt.cx/series/jaadugar-a-witch-in-mongolia/'
    },
    {
      title: "KONOSUBA - God's blessing on this wonderful world!",
      slug: 'konosuba-gods-blessing-on-this-wonderful-world',
      url: 'https://animesalt.cx/series/konosuba-gods-blessing-on-this-wonderful-world/'
    }
  ];

  for (const target of newSeriesTargets) {
    if (dbMap.has(target.slug)) {
      console.log(`[Already Exists] ${target.title}`);
      continue;
    }

    console.log(`\n[NEW SERIES] Fetching: "${target.title}" (${target.url})`);
    try {
      const { html, $, episodes } = await scrapeFullSeriesEpisodes(target.url);

      const title = $('h1').first().text().trim() || $('.entry-title').first().text().trim() || target.title;
      const description = $('.entry-content p, #description p, .synopsis p').first().text().trim() ||
                          $('.entry-content').first().text().trim() || '';

      const genres = [];
      $('a[href*="/category/genre/"], a[href*="/genre/"]').each((_, el) => {
        const t = $(el).text().trim();
        if (t && !genres.includes(t)) genres.push(t);
      });

      const audioLanguages = [];
      $('a[href*="/category/language/"], a[href*="/language/"]').each((_, el) => {
        const t = $(el).text().trim();
        if (t && !audioLanguages.includes(t)) audioLanguages.push(t);
      });

      console.log(`  Scraped ${episodes.length} episodes for "${title}"`);

      // Fetch TMDB and AniList art
      console.log('  Enriching with TMDB and AniList...');
      const tmdbArt = await fetchTMDBArt(title, 'series');
      const anilistData = await fetchAnilistMetadata(title);

      const poster = tmdbArt?.poster || anilistData?.coverImage || $('.post-thumbnail img, .poster img').first().attr('src') || '';
      const backdrop = tmdbArt?.backdrop || anilistData?.bannerImage || $('.TPostBg').first().attr('src') || '';

      const newItem = {
        title,
        slug: target.slug,
        saltSlug: target.slug,
        url: target.url,
        type: 'series',
        poster: poster.startsWith('//') ? 'https:' + poster : poster,
        backdrop: backdrop.startsWith('//') ? 'https:' + backdrop : backdrop,
        description: tmdbArt?.overview || anilistData?.description || description,
        genres: genres.length > 0 ? genres : (anilistData?.genres?.length ? anilistData.genres : ['Action', 'Adventure']),
        audioLanguages: audioLanguages.length > 0 ? audioLanguages : ['Hindi', 'Urdu', 'Japanese'],
        episodes,
        anilist: anilistData || null
      };

      db.unshift(newItem); // Place brand new series at the very top of catalog
      console.log(`✓ Added "${title}" to database with ${episodes.length} episodes!`);
    } catch (e) {
      console.error(`✗ Error scraping "${target.title}":`, e.message);
    }
  }

  // 2. Update existing series that have newly released episodes
  const seriesWithNewEps = [
    { slug: 'power-rangers', url: 'https://animesalt.cx/series/power-rangers/' },
    { slug: 'crayon-shin-chan-spin-off', url: 'https://animesalt.cx/series/crayon-shin-chan-spin-off/' },
    { slug: 'the-exiled-heavy-knight-knows-how-to-game-the-system', url: 'https://animesalt.cx/series/the-exiled-heavy-knight-knows-how-to-game-the-system/' },
    { slug: 'grand-blue-dreaming', url: 'https://animesalt.cx/series/grand-blue-dreaming/' }
  ];

  console.log('\n--- Updating Existing Series with New Episodes ---');
  for (const s of seriesWithNewEps) {
    const item = db.find(x => x.slug === s.slug);
    if (!item) continue;

    console.log(`Checking "${item.title}" (current eps: ${item.episodes?.length || 0})...`);
    try {
      const { episodes } = await scrapeFullSeriesEpisodes(s.url);
      if (episodes.length > (item.episodes?.length || 0)) {
        console.log(`✓ Updated "${item.title}" from ${item.episodes?.length || 0} to ${episodes.length} episodes!`);
        item.episodes = episodes;
      }
    } catch (err) {
      console.warn(`Failed to update episodes for ${item.title}:`, err.message);
    }
  }

  // Save to anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n💾 Database saved successfully! Total anime items: ${db.length}`);
}

main().catch(console.error);
