const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const catalog = JSON.parse(fs.readFileSync('scripts/toonstream_catalog_cache.json', 'utf8'));
const movies = catalog.filter(x => x.type === 'movie');

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  if (
    l.includes('themoviedb.org') ||
    l.includes('youtube.com') ||
    l.includes('google') ||
    l.includes('facebook') ||
    l.includes('about:blank') ||
    l.includes('short.icu') ||
    l.includes('short.link')
  ) {
    return false;
  }
  return true;
}

function extractStreamsFromHtml(html) {
  const $ = cheerio.load(html);
  const streams = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

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

async function main() {
  console.log(`Starting scrape of ${movies.length} movies from ToonStream...`);
  const concurrency = 12;
  const scrapedMovies = [];
  let successful = 0;

  for (let i = 0; i < movies.length; i += concurrency) {
    const batch = movies.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (item) => {
        const html = await fetchHtml(item.url);
        if (!html) return null;
        const $ = cheerio.load(html);
        const streams = extractStreamsFromHtml(html);
        const desc = $('.entry-content p, .description p, .synopsis, p').first().text().trim() || item.title;
        const genres = [];
        $('a[href*="/category/"]').each((_, el) => {
          const g = $(el).text().trim();
          if (g && !genres.includes(g) && !['Home', 'Anime', 'Cartoon', 'Movies'].includes(g)) genres.push(g);
        });

        const activeStreams = streams.filter(s => !s.includes('as-cdn'));
        const saltStreams = streams.filter(s => s.includes('as-cdn'));
        const primaryStream = activeStreams[0] || saltStreams[0] || '';

        const sources = [];
        activeStreams.forEach((s, idx) => {
          sources.push({
            label: idx === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${idx + 1} (Mirror)`,
            url: s,
            isMultiAudio: true
          });
        });
        saltStreams.forEach(s => {
          sources.push({
            label: 'AnimeSalt (Backup)',
            url: s,
            isMultiAudio: true
          });
        });

        return {
          ...item,
          description: desc,
          genres: genres.length > 0 ? genres : ['Animation', 'Action'],
          streamUrl: primaryStream,
          toonStreamUrl: activeStreams[0] || '',
          saltStreamUrl: saltStreams[0] || '',
          streamSources: sources
        };
      })
    );

    for (const r of results) {
      if (r && r.streamSources && r.streamSources.length > 0) {
        scrapedMovies.push(r);
        successful++;
      } else if (r) {
        scrapedMovies.push(r);
      }
    }

    process.stdout.write(`\rScraped ${Math.min(i + concurrency, movies.length)}/${movies.length} movies (${successful} with streams)`);
  }

  console.log(`\n\nMovie scrape complete: ${scrapedMovies.length} total, ${successful} with active streams!`);
  fs.writeFileSync('scripts/toonstream_movies_scraped.json', JSON.stringify(scrapedMovies, null, 2));
  console.log('Saved to scripts/toonstream_movies_scraped.json');
}

main().catch(console.error);
