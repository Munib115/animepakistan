const db = require('../src/data/anime-db.json');

// Check series
const series = db.filter(x => x.type === 'series');
const epStats = series.map(x => {
  const eps = x.episodes || [];
  const saltOnly = eps.filter(e =>
    (e.streamUrl || '').includes('as-cdn') &&
    !e.toonStreamUrl &&
    !(e.streamSources || []).some(s => !s.url.includes('as-cdn'))
  );
  return { title: x.title, slug: x.slug, toonSlug: x.toonSlug, total: eps.length, saltOnly: saltOnly.length };
}).filter(x => x.saltOnly > 0).sort((a, b) => b.saltOnly - a.saltOnly);

console.log('Series with AnimeSalt-only episodes:', epStats.length);
console.log('Top offenders:');
epStats.slice(0, 20).forEach(x => console.log(' -', x.title, ':', x.saltOnly + '/' + x.total, 'eps on AnimeSalt | toonSlug:', x.toonSlug || 'NONE'));

// Check movies
const movies = db.filter(x => x.type === 'movie');
const saltOnlyMovies = movies.filter(x =>
  (x.streamUrl || '').includes('as-cdn') && !x.toonStreamUrl
);
const noStreamMovies = movies.filter(x => !x.streamUrl && !x.toonStreamUrl);
console.log('\nMovies on AnimeSalt only:', saltOnlyMovies.length);
console.log('Movies with no stream:', noStreamMovies.length);
console.log('Sample salt-only movies:', saltOnlyMovies.slice(0, 10).map(x => x.title));
