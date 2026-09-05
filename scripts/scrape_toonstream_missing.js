const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const missingPath = path.join(__dirname, '..', 'scratch_toonstream_missing.json');
const missing = JSON.parse(fs.readFileSync(missingPath, 'utf8'));

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'toonstream-scraped.json');

// Concurrency pool
async function processInChunks(items, concurrency, workerFn) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      try {
        await workerFn(current);
      } catch (err) {}
    }
  }
  const workers = Array(Math.min(concurrency, items.length)).fill(0).map(() => worker());
  await Promise.all(workers);
}

async function scrapeMovie(item) {
  try {
    const res = await fetch(item.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const desc = $('.entry-content p, .description p, .synopsis').first().text().trim() || 'Urdu & Hindi Dubbed Anime Movie';
    let embed = $('iframe[src*="/embed/"]').attr('src') || $('iframe[data-src*="/embed/"]').attr('data-src');
    if (embed && !embed.startsWith('http')) embed = `https://toon-stream.site${embed}`;

    const genres = [];
    $('a[href*="/genre/"]').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });

    const yearMatch = html.match(/\b(20[0-2][0-9]|19[8-9][0-9])\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2023;

    return {
      id: `ts-${item.slug}`,
      title: item.title,
      slug: item.slug,
      type: 'movie',
      poster: item.poster,
      backdrop: item.poster,
      description: desc,
      genres: genres.length > 0 ? genres : ['Anime', 'Action'],
      rating: 8.2,
      year,
      streamUrl: embed || '',
      source: 'toon-stream'
    };
  } catch (e) {
    return null;
  }
}

async function scrapeEpisodeStream(epUrl) {
  try {
    const res = await fetch(epUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    let embed = $('iframe[src*="/embed/"]').attr('src') || $('iframe[data-src*="/embed/"]').attr('data-src');
    if (embed && !embed.startsWith('http')) embed = `https://toon-stream.site${embed}`;
    return embed || '';
  } catch (e) {
    return '';
  }
}

async function scrapeSeries(item) {
  try {
    const res = await fetch(item.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const desc = $('.entry-content p, .description p, .synopsis').first().text().trim() || 'Urdu & Hindi Dubbed Anime Series';
    const genres = [];
    $('a[href*="/genre/"]').each((_, el) => {
      const g = $(el).text().trim();
      if (g && !genres.includes(g)) genres.push(g);
    });

    const yearMatch = html.match(/\b(20[0-2][0-9]|19[8-9][0-9])\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : 2023;

    const epLinks = [];
    $('a[href*="/episode/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !epLinks.includes(href)) {
        epLinks.push(href.startsWith('http') ? href : `https://toon-stream.site${href}`);
      }
    });

    // Extract episodes
    const episodes = [];
    for (let i = 0; i < epLinks.length; i++) {
      const epUrl = epLinks[i];
      const match = epUrl.match(/(\d+)x(\d+)/i);
      const season = match ? parseInt(match[1], 10) : 1;
      const num = match ? parseInt(match[2], 10) : i + 1;
      const epSlugMatch = epUrl.match(/\/episode\/([^/]+)/);
      const epSlug = epSlugMatch ? epSlugMatch[1] : `${item.slug}-${season}x${num}`;

      episodes.push({
        number: num,
        season,
        title: `S${season} E${num}: Episode ${num}`,
        slug: epSlug,
        url: epUrl,
        thumbnail: item.poster,
        streamUrl: ''
      });
    }

    // Fast batch fetch episode streams (concurrency 10 per series)
    await processInChunks(episodes, 10, async (ep) => {
      const stream = await scrapeEpisodeStream(ep.url);
      if (stream) ep.streamUrl = stream;
    });

    return {
      id: `ts-${item.slug}`,
      title: item.title,
      slug: item.slug,
      type: 'series',
      poster: item.poster,
      backdrop: item.poster,
      description: desc,
      genres: genres.length > 0 ? genres : ['Anime', 'Action'],
      rating: 8.3,
      year,
      episodes,
      source: 'toon-stream'
    };
  } catch (e) {
    return null;
  }
}

async function run() {
  console.log(`--- Starting Scraping of ${missing.length} Missing ToonStream Anime ---`);

  // Load existing scraped if resuming
  let scraped = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      scraped = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      console.log(`Loaded ${scraped.length} already scraped items from previous run`);
    } catch (e) {}
  }

  const scrapedSlugs = new Set(scraped.map(s => s.slug));
  const remaining = missing.filter(m => !scrapedSlugs.has(m.slug));
  console.log(`Remaining items to scrape: ${remaining.length}`);

  let count = scraped.length;

  for (const item of remaining) {
    const t0 = Date.now();
    let result = null;
    if (item.type === 'movie') {
      result = await scrapeMovie(item);
    } else {
      result = await scrapeSeries(item);
    }

    if (result) {
      scraped.push(result);
      count++;
      const epInfo = result.episodes ? ` (${result.episodes.length} eps)` : '';
      console.log(`[${count}/${missing.length}] Scraped ${result.type.toUpperCase()}: ${result.title}${epInfo} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } else {
      console.log(`[!] Failed to scrape: ${item.title}`);
    }

    // Save checkpoint every 5 items
    if (count % 5 === 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(scraped, null, 2));
    }
  }

  // Final write
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(scraped, null, 2));
  console.log(`\nCompleted! Successfully scraped ${scraped.length} items to ${OUTPUT_PATH}`);
}

run().catch(console.error);
