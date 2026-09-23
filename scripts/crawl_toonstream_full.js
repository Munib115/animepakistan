const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CATALOG_CACHE_FILE = path.join(__dirname, 'toonstream_catalog_cache.json');

async function fetchPage(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function scrapeListingCategory(catName, maxPages) {
  console.log(`\nStarting crawl of category: ${catName} (1 to ${maxPages} pages)...`);
  const items = [];
  const concurrency = 6;
  const pages = [];
  for (let p = 1; p <= maxPages; p++) pages.push(p);

  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (p) => {
        const url = `https://toonstream.us/category/${catName}?type=all&page=${p}`;
        const html = await fetchPage(url);
        if (!html) return [];
        const $ = cheerio.load(html);
        const pageItems = [];

        $('article').each((_, el) => {
          const linkEl = $(el).find('a').first();
          const href = linkEl.attr('href') || '';
          const title = $(el).find('.entry-title, h2, h3').text().trim() || linkEl.attr('title') || '';
          const img = $(el).find('img').attr('data-src') || $(el).find('img').attr('src') || '';
          const ratingText = $(el).find('.vote').text().trim();
          const isMovie = href.includes('/movies/');

          if (href && title) {
            const cleanHref = href.startsWith('http') ? href : `https://toonstream.us${href}`;
            const slug = href.replace(/^\/(series|movies)\//, '').replace(/\/$/, '');
            pageItems.push({
              title,
              url: cleanHref,
              slug,
              type: isMovie ? 'movie' : 'series',
              poster: img,
              rating: ratingText ? parseFloat(ratingText.replace(/[^\d.]/g, '')) || 8.0 : 8.0,
              category: catName
            });
          }
        });

        return pageItems;
      })
    );

    for (const res of results) {
      items.push(...res);
    }
    process.stdout.write(`\r[${catName}] Crawled page ${Math.min(i + concurrency, maxPages)}/${maxPages} - Found ${items.length} items so far`);
  }

  console.log(`\nCompleted ${catName}: ${items.length} items collected.`);
  return items;
}

async function main() {
  const animeItems = await scrapeListingCategory('anime', 46);
  const cartoonItems = await scrapeListingCategory('cartoon', 35);
  const movieItems = await scrapeListingCategory('movies', 36);

  // Deduplicate by URL/slug
  const map = new Map();
  for (const item of [...animeItems, ...cartoonItems, ...movieItems]) {
    if (!map.has(item.url)) {
      map.set(item.url, item);
    }
  }

  const allItems = Array.from(map.values());
  console.log(`\n========================================`);
  console.log(`Total unique ToonStream items found: ${allItems.length}`);
  console.log(`Movies: ${allItems.filter(x => x.type === 'movie').length}`);
  console.log(`Series: ${allItems.filter(x => x.type === 'series').length}`);

  fs.writeFileSync(CATALOG_CACHE_FILE, JSON.stringify(allItems, null, 2));
  console.log(`Saved catalog cache to: ${CATALOG_CACHE_FILE}`);
}

main().catch(console.error);
