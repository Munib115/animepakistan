const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const targetUrl = url.replace(/^http:\/\//i, 'https://');
    const client = targetUrl.startsWith('https') ? https : http;

    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parsePoster(html) {
  const $ = cheerio.load(html);
  
  const posterCandidates = [
    $('.poster img').attr('data-src') || $('.poster img').attr('src'),
    $('.entry-header img').attr('data-src') || $('.entry-header img').attr('src'),
    $('.post-thumbnail img').attr('data-src') || $('.post-thumbnail img').attr('src'),
    $('.thumb img').attr('data-src') || $('.thumb img').attr('src'),
    $('img.TPostBg').attr('data-src') || $('img.TPostBg').attr('src'),
    $('meta[property="og:image"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content'),
  ];

  for (const p of posterCandidates) {
    if (p && !p.startsWith('data:image') && !p.includes('AnimeSaltLong.png')) {
      return p.startsWith('//') ? 'https:' + p : p;
    }
  }

  let found = '';
  $('img').each((i, el) => {
    const dSrc = $(el).attr('data-src') || $(el).attr('src') || '';
    if (dSrc && !dSrc.startsWith('data:image') && !dSrc.includes('AnimeSaltLong.png') && (dSrc.includes('tmdb.org') || dSrc.includes('image') || dSrc.includes('thumb'))) {
      found = dSrc.startsWith('//') ? 'https:' + dSrc : dSrc;
      return false;
    }
  });

  return found;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== SYNCING ALL 517 ITEMS FROM ANIMESALT SITEMAPS ===');

  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {}

  const existingMap = new Map();
  for (const item of existing) {
    const slug = item.slug || item.url.split('/').filter(Boolean).pop();
    existingMap.set(slug, item);
  }

  // 1. Fetch Series Sitemaps
  const seriesSitemaps = [
    'https://animesalt.link/series-sitemap1.xml',
    'https://animesalt.link/series-sitemap2.xml',
  ];

  const seriesUrls = [];
  for (const sm of seriesSitemaps) {
    const xml = await fetchPage(sm);
    const $ = cheerio.load(xml, { xmlMode: true });
    $('url loc').each((_, el) => {
      seriesUrls.push($(el).text().trim());
    });
  }

  // 2. Fetch Movies Sitemap
  const moviesXml = await fetchPage('https://animesalt.link/movies-sitemap.xml');
  const $m = cheerio.load(moviesXml, { xmlMode: true });
  const moviesUrls = [];
  $m('url loc').each((_, el) => {
    moviesUrls.push($m(el).text().trim());
  });

  console.log(`Found ${seriesUrls.length} series and ${moviesUrls.length} movies in sitemaps.`);

  const allEntries = [
    ...seriesUrls.map(u => ({ url: u, type: 'series' })),
    ...moviesUrls.map(u => ({ url: u, type: 'movie' })),
  ];

  let added = 0;
  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const slug = entry.url.split('/').filter(Boolean).pop();

    if (!existingMap.has(slug)) {
      console.log(`[${i + 1}/${allEntries.length}] New item: ${slug}`);
      try {
        const html = await fetchPage(entry.url);
        const $ = cheerio.load(html);
        const title = $('h1.entry-title').text().trim() || $('h1').first().text().trim() || slug.replace(/-/g, ' ');
        const poster = parsePoster(html);

        const newItem = {
          title,
          slug,
          url: entry.url.replace(/^http:\/\//i, 'https://'),
          type: entry.type,
          poster: poster || '',
          description: $('.entry-content p').first().text().trim() || '',
          genres: [],
          audioLanguages: ['Hindi', 'Urdu', 'Japanese'],
          episodes: [],
          anilist: null,
        };

        existing.push(newItem);
        existingMap.set(slug, newItem);
        added++;
        console.log(`  -> Added: ${title} with poster: ${poster}`);
      } catch (e) {
        console.error(`  -> Failed to scrape ${entry.url}: ${e.message}`);
      }

      await delay(100);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`=== SYNC COMPLETE: Added ${added} new items. Total DB count: ${existing.length} ===`);
}

main();
