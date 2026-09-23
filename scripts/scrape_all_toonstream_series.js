const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const catalog = JSON.parse(fs.readFileSync('scripts/toonstream_catalog_cache.json', 'utf8'));
const seriesList = catalog.filter(x => x.type === 'series');

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://toonstream.us/'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function scrapeSeries(item) {
  const html = await fetchHtml(item.url);
  if (!html) return null;
  const $ = cheerio.load(html);

  const desc = $('.entry-content p, .description p, .synopsis, p').first().text().trim() || item.title;
  const genres = [];
  $('a[href*="/category/"]').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g) && !['Home', 'Anime', 'Cartoon', 'Movies'].includes(g)) genres.push(g);
  });

  const epLinks = [];
  $('a[href*="/episode/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !epLinks.includes(href)) {
      epLinks.push(href.startsWith('http') ? href : `https://toonstream.us${href}`);
    }
  });

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

  // Sort episodes by season then number
  episodes.sort((a, b) => a.season === b.season ? a.number - b.number : a.season - b.season);

  return {
    ...item,
    description: desc,
    genres: genres.length > 0 ? genres : ['Animation', 'Action'],
    episodesCount: episodes.length,
    episodes
  };
}

async function main() {
  console.log(`Starting metadata & episode list scrape for ${seriesList.length} series...`);
  const concurrency = 12;
  const scrapedSeries = [];
  let totalEpisodes = 0;

  for (let i = 0; i < seriesList.length; i += concurrency) {
    const batch = seriesList.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(s => scrapeSeries(s)));

    for (const r of results) {
      if (r) {
        scrapedSeries.push(r);
        totalEpisodes += r.episodes.length;
      }
    }

    process.stdout.write(`\rScraped ${Math.min(i + concurrency, seriesList.length)}/${seriesList.length} series (${totalEpisodes} total episodes)`);
  }

  console.log(`\n\nSeries scrape complete: ${scrapedSeries.length} series, ${totalEpisodes} total episodes!`);
  fs.writeFileSync('scripts/toonstream_series_meta.json', JSON.stringify(scrapedSeries, null, 2));
  console.log('Saved to scripts/toonstream_series_meta.json');
}

main().catch(console.error);
