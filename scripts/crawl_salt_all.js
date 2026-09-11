const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const existingSlugs = new Set(db.map(x => x.slug.toLowerCase().trim()));
const existingSaltSlugs = new Set(db.map(x => (x.saltSlug || x.slug).toLowerCase().trim()));

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.cx/'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log('--- Crawling AnimeSalt Series & Movies ---');
  
  // 1. Crawl /series/
  const saltSeries = [];
  for (let p = 1; p <= 10; p++) {
    const url = p === 1 ? 'https://animesalt.cx/series/' : `https://animesalt.cx/series/page/${p}/`;
    const html = await fetchHtml(url);
    if (!html) break;
    const $ = cheerio.load(html);
    const articles = $('article');
    if (articles.length === 0) break;

    articles.each((_, el) => {
      const linkEl = $(el).find('a').first();
      const href = linkEl.attr('href') || '';
      const title = $(el).find('.entry-title, .title, h2, h3').text().trim() || $(el).find('img').attr('alt') || '';
      const slugMatch = href.match(/\/series\/([^/]+)/);
      const slug = slugMatch ? slugMatch[1] : '';
      if (slug && !saltSeries.some(x => x.slug === slug)) {
        saltSeries.push({ title, slug, url: href, type: 'series' });
      }
    });
  }
  console.log(`Found ${saltSeries.length} total series on AnimeSalt.`);

  // 2. Crawl /movies/
  const saltMovies = [];
  for (let p = 1; p <= 10; p++) {
    const url = p === 1 ? 'https://animesalt.cx/movies/' : `https://animesalt.cx/movies/page/${p}/`;
    const html = await fetchHtml(url);
    if (!html) break;
    const $ = cheerio.load(html);
    const articles = $('article');
    if (articles.length === 0) break;

    articles.each((_, el) => {
      const linkEl = $(el).find('a').first();
      const href = linkEl.attr('href') || '';
      const title = $(el).find('.entry-title, .title, h2, h3').text().trim() || $(el).find('img').attr('alt') || '';
      const slugMatch = href.match(/\/movies\/([^/]+)/);
      const slug = slugMatch ? slugMatch[1] : '';
      if (slug && !saltMovies.some(x => x.slug === slug)) {
        saltMovies.push({ title, slug, url: href, type: 'movie' });
      }
    });
  }
  console.log(`Found ${saltMovies.length} total movies on AnimeSalt.`);

  // 3. Find missing series/movies from DB
  const missingSeries = saltSeries.filter(s => !existingSlugs.has(s.slug.toLowerCase()) && !existingSaltSlugs.has(s.slug.toLowerCase()));
  const missingMovies = saltMovies.filter(m => !existingSlugs.has(m.slug.toLowerCase()) && !existingSaltSlugs.has(m.slug.toLowerCase()));

  console.log(`\nNew / Missing Series (${missingSeries.length}):`);
  missingSeries.forEach(s => console.log(`  - [SERIES] ${s.title} (${s.slug}) -> ${s.url}`));

  console.log(`\nNew / Missing Movies (${missingMovies.length}):`);
  missingMovies.forEach(m => console.log(`  - [MOVIE] ${m.title} (${m.slug}) -> ${m.url}`));

  // 4. Check series on homepage for new episode counts vs our DB
  const homeHtml = await fetchHtml('https://animesalt.cx/');
  const homeSeriesUrls = new Set();
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    $('article.episodes, .episodes article, article').each((_, el) => {
      const href = $(el).find('a').attr('href');
      if (href && href.includes('/series/')) {
        const m = href.match(/https:\/\/animesalt\.cx\/series\/[^/]+\//);
        if (m) homeSeriesUrls.add(m[0]);
      }
    });
  }

  console.log(`\nFound ${homeSeriesUrls.size} recently updated series on AnimeSalt homepage:`);
  homeSeriesUrls.forEach(u => console.log(`  - ${u}`));
}

main();
