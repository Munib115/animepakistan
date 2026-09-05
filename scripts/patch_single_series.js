const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const targetSlug = process.argv[2] || 'tomb-raider-king';

async function main() {
  const anime = db.find(a => a.slug === targetSlug || a.saltSlug === targetSlug);
  if (!anime) {
    console.error('Anime not found for slug:', targetSlug);
    return;
  }

  console.log(`Patching ${anime.title} (${anime.episodes?.length || 0} episodes)...`);
  for (const ep of (anime.episodes || [])) {
    if (!ep.url || !ep.url.startsWith('http')) continue;
    console.log(`Fetching Ep ${ep.number}: ${ep.url}`);
    try {
      const res = await fetch(ep.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://animesalt.cx/',
        }
      });
      if (!res.ok) {
        console.log(`Failed HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      let stream = null;
      $('iframe').each((_, elem) => {
        const src = $(elem).attr('src') || $(elem).attr('data-src') || '';
        if (src.includes('multi-lang-plyr/player.php?data=')) {
          stream = src;
        } else if (!stream && src.startsWith('http') && !src.includes('google') && !src.includes('disqus')) {
          stream = src;
        }
      });

      console.log(`  -> streamUrl: ${stream}`);
      if (stream) {
        ep.streamUrl = stream;
      }
    } catch (e) {
      console.error(`Error on ep ${ep.number}:`, e.message);
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Successfully updated ${anime.title} in anime-db.json!`);
}

main();
