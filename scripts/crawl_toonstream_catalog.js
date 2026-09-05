const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Build quick lookup of our existing titles and slugs
const ourTitles = new Set(db.map(a => a.title.toLowerCase().trim()));
const ourSlugs = new Set(db.map(a => a.slug.toLowerCase().trim()));
if (db[0]?.saltSlug) {
  db.forEach(a => {
    if (a.saltSlug) ourSlugs.add(a.saltSlug.toLowerCase().trim());
  });
}

function normalizeTitle(t) {
  return t.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ourNormalizedTitles = new Set(db.map(a => normalizeTitle(a.title)));

async function fetchPage(pageNum) {
  const url = `https://toon-stream.site/category/anime?type=all&page=${pageNum}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://toon-stream.site/'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      const items = [];

      $('article, .post, .entry, [class*="item"], .poster-item, div.item').each((_, el) => {
        const linkEl = $(el).find('a.lnk-blk, a[href*="/series/"], a[href*="/movies/"]').first();
        const href = linkEl.attr('href') || $(el).find('a').attr('href');
        if (!href) return;

        // Skip non-anime links
        if (!href.includes('/series/') && !href.includes('/movies/')) return;

        const titleEl = $(el).find('h2, h3, .title, .entry-title').first();
        let title = titleEl.text().trim();
        if (!title) {
          title = $(el).find('img').attr('alt')?.trim() || '';
        }

        const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        const isMovie = href.includes('/movies/');
        const slugMatch = href.match(/\/(series|movies)\/([^/]+)/);
        const slug = slugMatch ? slugMatch[2] : href.replace(/^.*\//, '');

        if (slug && !items.some(x => x.slug === slug)) {
          items.push({
            title: title || slug.replace(/-/g, ' ').toUpperCase(),
            slug,
            url: href.startsWith('http') ? href : `https://toon-stream.site${href}`,
            poster: img || '',
            type: isMovie ? 'movie' : 'series'
          });
        }
      });

      return items;
    } catch (e) {}
  }
  return [];
}

async function run() {
  console.log('Crawling toon-stream.site anime catalog (45 pages)...');
  const allToonAnime = [];

  for (let p = 1; p <= 45; p++) {
    const items = await fetchPage(p);
    allToonAnime.push(...items);
    process.stdout.write(`Page ${p}/45: found ${items.length} items (Total: ${allToonAnime.length})\r`);
  }

  console.log(`\n\nFinished crawl! Total items on toon-stream: ${allToonAnime.length}`);

  // Deduplicate
  const uniqueToon = [];
  const seenSlugs = new Set();
  for (const item of allToonAnime) {
    if (!seenSlugs.has(item.slug)) {
      seenSlugs.add(item.slug);
      uniqueToon.push(item);
    }
  }

  console.log(`Unique items on toon-stream: ${uniqueToon.length}`);

  // Find which ones we don't have
  const missing = [];
  for (const item of uniqueToon) {
    const norm = normalizeTitle(item.title);
    const slugNorm = item.slug.toLowerCase().trim();

    const exists = ourSlugs.has(slugNorm) || ourNormalizedTitles.has(norm);
    if (!exists) {
      missing.push(item);
    }
  }

  console.log(`\nItems missing from our database: ${missing.length}`);
  fs.writeFileSync('scratch_toonstream_missing.json', JSON.stringify(missing, null, 2));
  console.log('Saved missing items to scratch_toonstream_missing.json');
  console.log('Sample missing items:');
  console.log(missing.slice(0, 15).map(m => ({ title: m.title, slug: m.slug, type: m.type })));
}

run().catch(console.error);
