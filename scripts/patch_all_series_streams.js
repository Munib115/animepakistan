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
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(epUrl, {
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

    // 1. Check for multi-lang player data attribute or iframe
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

    // Also check data-player / data-embed attributes
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

    // Prefer multiLangUrl if available because it has Hindi / Tamil / Telugu / English audio
    const chosen = multiLangUrl || cdnUrl;
    return chosen ? chosen.trim() : null;
  } catch (err) {
    return null;
  }
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
  const CONCURRENCY = 12;

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

      if (processed % 10 === 0 || processed === tasks.length) {
        console.log(`[${processed}/${tasks.length}] Patched: ${patchedCount}, Failed: ${failCount} (Current: ${task.anime.title} - ${task.ep.slug})`);
      }

      // Save every 50 episodes
      if (processed % 50 === 0) {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      }
    }
  }

  // First, let's prioritize tomb-raider-king and popular series
  const priorityIndex = tasks.filter(t => 
    t.anime.slug.includes('tomb-raider') || 
    t.anime.slug.includes('naruto') || 
    t.anime.slug.includes('dragon-ball') ||
    t.anime.slug.includes('one-piece') ||
    t.anime.slug.includes('attack-on-titan') ||
    t.anime.slug.includes('bleach') ||
    t.anime.slug.includes('pokemon') ||
    t.anime.slug.includes('death-note') ||
    t.anime.slug.includes('hunter') ||
    t.anime.slug.includes('jujutsu') ||
    t.anime.slug.includes('demon-slayer')
  );
  
  const remaining = tasks.filter(t => !priorityIndex.includes(t));
  const queue = [...priorityIndex, ...remaining];

  const workers = Array.from({ length: CONCURRENCY }, () => worker(queue));
  await Promise.all(workers);

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\nDone! Successfully patched ${patchedCount} episodes. Failed: ${failCount}`);
}

main().catch(console.error);
