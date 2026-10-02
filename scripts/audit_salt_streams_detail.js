const cheerio = require('cheerio');
const db = require('../src/data/anime-db.json');

async function audit() {
  const sitemaps = [
    'https://animesalt.cx/movies-sitemap1.xml',
    'https://animesalt.cx/movies-sitemap2.xml',
    'https://animesalt.cx/series-sitemap1.xml',
    'https://animesalt.cx/series-sitemap2.xml',
    'https://animesalt.cx/series-sitemap3.xml'
  ];

  const saltSlugs = new Set();
  for (const sm of sitemaps) {
    const xml = await (await fetch(sm, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const $ = cheerio.load(xml, { xmlMode: true });
    $('loc').each((_, el) => {
      const u = $(el).text().trim();
      const m = u.match(/\/(movies|series)\/([^/]+)/);
      if (m) saltSlugs.add(m[2].toLowerCase().trim());
    });
  }

  let totalSaltMovies = 0;
  let moviesWithStreams = 0;
  let moviesWithoutStreams = [];

  let totalSaltSeries = 0;
  let seriesWithAllStreams = 0;
  let seriesWithPartialStreams = 0;
  let seriesWithNoStreams = [];
  let totalSaltEpisodes = 0;
  let episodesWithStreams = 0;
  let episodesWithoutStreams = [];

  for (const item of db) {
    const slug = (item.saltSlug || item.slug || '').toLowerCase().trim();
    if (!saltSlugs.has(slug)) continue;

    if (item.type === 'movie') {
      totalSaltMovies++;
      const s = item.streamSources || [];
      if (s.length > 0) {
        moviesWithStreams++;
      } else {
        moviesWithoutStreams.push(item);
      }
    } else {
      totalSaltSeries++;
      const eps = item.episodes || [];
      let epHas = 0;
      for (const ep of eps) {
        totalSaltEpisodes++;
        const s = ep.streamSources || [];
        if (s.length > 0) {
          episodesWithStreams++;
          epHas++;
        } else {
          episodesWithoutStreams.push({
            animeSlug: slug,
            epSlug: ep.slug,
            epUrl: ep.url,
            season: ep.season || 1,
            number: ep.number || 1
          });
        }
      }
      if (eps.length > 0 && epHas === eps.length) {
        seriesWithAllStreams++;
      } else if (epHas > 0) {
        seriesWithPartialStreams++;
      } else {
        seriesWithNoStreams.push(item);
      }
    }
  }

  console.log('=== AnimeSalt Audit Summary ===');
  console.log(`Movies: ${moviesWithStreams} / ${totalSaltMovies} (${((moviesWithStreams / totalSaltMovies) * 100).toFixed(1)}%)`);
  console.log(`Series: ${seriesWithAllStreams} full, ${seriesWithPartialStreams} partial, ${seriesWithNoStreams.length} none of ${totalSaltSeries}`);
  console.log(`Episodes: ${episodesWithStreams} / ${totalSaltEpisodes} (${((episodesWithStreams / totalSaltEpisodes) * 100).toFixed(1)}%)`);
  console.log(`Movies without streams: ${moviesWithoutStreams.length}`);
  console.log(`Episodes without streams: ${episodesWithoutStreams.length}`);
}

audit().catch(console.error);
