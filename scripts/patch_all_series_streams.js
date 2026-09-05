const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Helper to check if URL is a valid video stream embed
function isValidStreamUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http')) return false;
  if (lower.includes('animesalt.cx/episode') || 
      lower.includes('animesalt.cx/series') || 
      lower.includes('animesalt.cx/movies')) {
    return false;
  }
  if (lower.includes('google') || lower.includes('doubleclick') || lower.includes('disqus')) {
    return false;
  }
  return true;
}

async function fetchEpisodeStream(epUrl) {
  async function tryFetch(url) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://animesalt.cx/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      let multiLangUrl = null;
      let cdnUrl = null;

      $('iframe').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src.includes('multi-lang-plyr/player.php?data=')) {
          multiLangUrl = src.startsWith('//') ? 'https:' + src : src;
        } else if (isValidStreamUrl(src) && !cdnUrl) {
          cdnUrl = src.startsWith('//') ? 'https:' + src : src;
        }
      });

      if (!cdnUrl && !multiLangUrl) {
        $('[data-player], [data-embed], .playex').each((_, el) => {
          const embed = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-src');
          if (embed && isValidStreamUrl(embed)) {
            if (embed.includes('multi-lang-plyr/player.php?data=')) {
              multiLangUrl = embed;
            } else if (!cdnUrl) {
              cdnUrl = embed;
            }
          }
        });
      }

      const chosen = multiLangUrl || cdnUrl;
      return chosen ? chosen.trim() : null;
    } catch (err) {
      return null;
    }
  }

  let result = await tryFetch(epUrl);
  if (!result) {
    if (epUrl.includes('/episode/private-')) {
      result = await tryFetch(epUrl.replace('/episode/private-', '/episode/'));
    } else if (epUrl.includes('/episode/')) {
      result = await tryFetch(epUrl.replace('/episode/', '/episode/private-'));
    }
  }
  return result;
}

async function main() {
  console.log('--- AnimePakistan Stream Patcher ---');
  
  // Find all episodes needing streamUrl
  const tasks = [];
  for (const item of db) {
    if (item.type !== 'series' || !item.episodes) continue;
    for (const ep of item.episodes) {
      if (!ep.streamUrl && ep.url && ep.url.startsWith('http')) {
        tasks.push({ anime: item, ep });
      }
    }
  }

  console.log(`Found ${tasks.length} episodes missing streamUrl.`);
  if (tasks.length === 0) {
    console.log('All episodes already have streamUrl!');
    return;
  }

  let patchedCount = 0;
  let failCount = 0;
  let processed = 0;
  const CONCURRENCY = 20;

  async function worker(queue) {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const stream = await fetchEpisodeStream(task.ep.url);
      processed++;
      if (stream) {
        task.ep.streamUrl = stream;
        patchedCount++;
      } else {
        failCount++;
      }

      if (processed % 20 === 0 || processed === tasks.length) {
        console.log(`[${processed}/${tasks.length}] Patched: ${patchedCount}, Failed: ${failCount} (Current: ${task.anime.title} - ${task.ep.slug})`);
      }

      // Save every 40 episodes
      if (processed % 40 === 0) {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      }
    }
  }

  const queue = [...tasks];

  // Graceful shutdown: save DB whenever stopped
  function saveOnExit() {
    console.log(`\nSaving database to disk (${patchedCount} patched so far)...`);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    try {
      const catalog = db.map((item) => ({
        title: item.title,
        slug: item.slug,
        saltSlug: item.saltSlug,
        url: item.url,
        type: item.type,
        poster: item.poster,
        backdrop: item.backdrop,
        description: item.description ? item.description.slice(0, 200) : '',
        genres: item.genres,
        audioLanguages: item.audioLanguages,
        episodeCount: item.episodes?.length || 0,
        anilist: item.anilist
          ? {
              id: item.anilist.id,
              romajiName: item.anilist.romajiName,
              englishName: item.anilist.englishName,
              nativeName: item.anilist.nativeName,
              description: '',
              coverImage: item.anilist.coverImage,
              bannerImage: item.anilist.bannerImage,
              rating: item.anilist.rating,
              year: item.anilist.year,
              season: item.anilist.season,
              status: item.anilist.status,
              genres: item.anilist.genres,
            }
          : null,
      }));
      fs.writeFileSync(path.join(__dirname, '../src/data/anime-catalog.json'), JSON.stringify(catalog), 'utf8');
      console.log('Catalog also synced!');
    } catch (e) {}
    console.log('Database successfully saved!');
  }

  process.on('SIGINT', () => {
    saveOnExit();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    saveOnExit();
    process.exit(0);
  });

  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
  await Promise.all(workers);

  saveOnExit();
  console.log(`\nDone! Successfully patched ${patchedCount} episodes. Failed: ${failCount}`);
}

main().catch(console.error);

