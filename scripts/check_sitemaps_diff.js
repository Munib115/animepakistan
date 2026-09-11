const cheerio = require('cheerio');
const fs = require('fs');

const db = JSON.parse(fs.readFileSync('src/data/anime-db.json', 'utf8'));
const slugs = new Set(db.map(x => x.slug.toLowerCase().trim()));
db.forEach(x => { if (x.saltSlug) slugs.add(x.saltSlug.toLowerCase().trim()); });

async function checkSitemaps() {
  const sitemaps = [
    'https://animesalt.cx/movies-sitemap1.xml',
    'https://animesalt.cx/movies-sitemap2.xml',
    'https://animesalt.cx/series-sitemap1.xml',
    'https://animesalt.cx/series-sitemap2.xml',
    'https://animesalt.cx/series-sitemap3.xml'
  ];
  let missing = [];
  for (const sm of sitemaps) {
    try {
      const res = await fetch(sm, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      $('loc').each((_, elem) => {
        const url = $(elem).text().trim();
        const slug = url.split('/').filter(Boolean).pop()?.toLowerCase();
        if (slug && !slugs.has(slug) && slug !== 'movies' && slug !== 'series') {
          missing.push({ url, slug, type: sm.includes('movies') ? 'movie' : 'series' });
          slugs.add(slug);
        }
      });
    } catch (e) {
      console.error(e.message);
    }
  }
  console.log('Total new/missing items from all sitemaps:', missing.length);
  missing.forEach(m => console.log(`[${m.type}] ${m.slug} -> ${m.url}`));
}

checkSitemaps();
