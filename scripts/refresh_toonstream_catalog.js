/**
 * scripts/refresh_toonstream_catalog.js
 *
 * Refreshes the toonstream_catalog_cache.json by crawling all
 * categories on toonstream.us (anime, cartoons, movies).
 *
 * Usage: node scripts/refresh_toonstream_catalog.js
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CATALOG_OUT = path.join(__dirname, 'toonstream_catalog_cache.json');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Referer': 'https://toonstream.us/',
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchPage(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      if (!res.ok) { await delay(1000); continue; }
      return await res.text();
    } catch (e) {
      if (i === retries - 1) return null;
      await delay(1500);
    }
  }
  return null;
}

function parseItems(html, category) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];
  const seenSlugs = new Set();

  $('article, .item, .poster-item').each((_, el) => {
    const linkEl = $(el).find('a[href*="/series/"], a[href*="/movies/"]').first() ||
                   $(el).find('a.lnk-blk').first();
    const href = $(el).find('a[href*="/series/"]').attr('href') ||
                 $(el).find('a[href*="/movies/"]').attr('href') || '';
    if (!href) return;

    const isMovie = href.includes('/movies/');
    const slugMatch = href.match(/\/(series|movies)\/([^/?\s]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[2].replace(/\/$/, '');
    if (seenSlugs.has(slug)) return;
    seenSlugs.add(slug);

    const title = $(el).find('h2, h3, .entry-title, .title, [class*="title"]').first().text().trim() ||
                  $(el).find('a').first().attr('title') || '';
    const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
    const ratingText = $(el).find('[class*="rating"], .imdb').text().trim();
    const rating = ratingText ? parseFloat(ratingText) || 0 : 0;

    const fullUrl = href.startsWith('http') ? href : 'https://toonstream.us' + href;

    items.push({
      title: title || slug.replace(/-/g, ' '),
      url: fullUrl,
      slug,
      type: isMovie ? 'movie' : 'series',
      poster: img,
      rating: rating || 0,
      category,
    });
  });

  return items;
}

async function crawlCategory(cat, maxPages = 30) {
  const items = [];
  const seenSlugs = new Set();
  console.log('Crawling category: ' + cat);

  for (let page = 1; page <= maxPages; page++) {
    const url = 'https://toonstream.us/category/' + cat + '?type=all&page=' + page;
    const html = await fetchPage(url);
    if (!html) { console.log('  Page ' + page + ': failed'); break; }

    const pageItems = parseItems(html, cat);
    if (pageItems.length === 0) {
      console.log('  Page ' + page + ': empty — stopping');
      break;
    }

    let newCount = 0;
    for (const item of pageItems) {
      if (!seenSlugs.has(item.slug)) {
        seenSlugs.add(item.slug);
        items.push(item);
        newCount++;
      }
    }

    process.stdout.write('  Page ' + page + ': ' + newCount + ' new items (total: ' + items.length + ')\r');
    await delay(600);
  }

  console.log('\n  Done: ' + items.length + ' items in ' + cat);
  return items;
}

async function main() {
  console.log('ToonStream Catalog Refresher');
  console.log('='.repeat(40));

  let existing = [];
  if (fs.existsSync(CATALOG_OUT)) {
    try { existing = JSON.parse(fs.readFileSync(CATALOG_OUT, 'utf8')); } catch (e) {}
  }
  console.log('Existing catalog: ' + existing.length + ' items');

  const allItems = [];
  const seenGlobal = new Set(existing.map(x => x.slug));

  // Load existing first
  for (const item of existing) {
    allItems.push(item);
  }

  // Crawl fresh from ToonStream (3 categories)
  for (const cat of ['anime', 'cartoon', 'movies']) {
    const catItems = await crawlCategory(cat, 30);
    let added = 0;
    for (const item of catItems) {
      if (!seenGlobal.has(item.slug)) {
        seenGlobal.add(item.slug);
        allItems.push(item);
        added++;
      } else {
        // Update existing entry with fresh data
        const idx = allItems.findIndex(x => x.slug === item.slug);
        if (idx >= 0 && item.title && item.title.length > allItems[idx].title.length) {
          allItems[idx] = { ...allItems[idx], ...item };
        }
      }
    }
    console.log('Added ' + added + ' new items from ' + cat);
  }

  // Also crawl the movies category with "movies" type explicitly
  const movieItems = await crawlCategory('movies', 20);
  let movieAdded = 0;
  for (const item of movieItems) {
    if (!seenGlobal.has(item.slug)) {
      seenGlobal.add(item.slug);
      allItems.push(item);
      movieAdded++;
    }
  }
  console.log('Added ' + movieAdded + ' more unique movies');

  console.log('\nTotal catalog items: ' + allItems.length);
  fs.writeFileSync(CATALOG_OUT, JSON.stringify(allItems, null, 2));
  console.log('Saved to: ' + CATALOG_OUT);
}

main().catch(console.error);
