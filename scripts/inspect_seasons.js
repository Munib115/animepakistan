const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function inspectSitemaps() {
  console.log('Fetching sitemaps from AnimeSalt...');
  const sitemaps = [
    'https://animesalt.link/movies-sitemap.xml',
    'https://animesalt.link/series-sitemap1.xml',
    'https://animesalt.link/series-sitemap2.xml',
  ];

  let allUrls = [];
  for (const sm of sitemaps) {
    try {
      const xml = await fetchUrl(sm);
      const urls = [...xml.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);
      console.log(`Found ${urls.length} urls in ${sm}`);
      allUrls.push(...urls);
    } catch (e) {
      console.error(`Error fetching ${sm}:`, e.message);
    }
  }

  console.log(`Total URLs found across sitemaps: ${allUrls.length}`);

  // Find My Hero Academia entries
  const mha = allUrls.filter(u => u.includes('hero-academia'));
  console.log('\n--- My Hero Academia entries on AnimeSalt: ---');
  console.log(mha);

  // Find Doraemon entries
  const doraemon = allUrls.filter(u => u.includes('doraemon'));
  console.log('\n--- Doraemon entries on AnimeSalt: ---');
  console.log(doraemon);

  // Find all series vs movies
  const series = allUrls.filter(u => u.includes('/series/'));
  const movies = allUrls.filter(u => u.includes('/movie/'));
  console.log(`\nTotal series in sitemap: ${series.length}, Total movies in sitemap: ${movies.length}`);
}

inspectSitemaps().catch(console.error);
