const fs = require('fs');
const cheerio = require('cheerio');

const missing = JSON.parse(fs.readFileSync('scratch_toonstream_missing.json', 'utf8'));

async function scrapeMovie(item) {
  try {
    const res = await fetch(item.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000)
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

    return {
      id: `ts-${item.slug}`,
      title: item.title,
      slug: item.slug,
      type: 'movie',
      poster: item.poster,
      backdrop: item.poster,
      description: desc,
      genres: genres.length > 0 ? genres : ['Anime', 'Action'],
      streamUrl: embed || '',
      source: 'toon-stream'
    };
  } catch (e) {
    return null;
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

    return {
      id: `ts-${item.slug}`,
      title: item.title,
      slug: item.slug,
      type: 'series',
      poster: item.poster,
      backdrop: item.poster,
      description: desc,
      genres: genres.length > 0 ? genres : ['Anime', 'Action'],
      episodes,
      source: 'toon-stream'
    };
  } catch (e) {
    return null;
  }
}

async function test() {
  const sampleMovie = missing.find(x => x.type === 'movie');
  const sampleSeries = missing.find(x => x.type === 'series');

  console.log('Testing movie scrape:', sampleMovie?.title);
  const m = await scrapeMovie(sampleMovie);
  console.log('Result movie:', m);

  console.log('\nTesting series scrape:', sampleSeries?.title);
  const s = await scrapeSeries(sampleSeries);
  console.log('Result series:', {
    title: s?.title,
    epCount: s?.episodes?.length,
    ep1: s?.episodes?.[0]
  });
}

test();
