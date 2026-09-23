const cheerio = require('cheerio');
const db = require('../src/data/anime-db.json');
const series = db.find(x => x.slug === 'naruto');
console.log('Series:', series.title, 'toonSlug:', series.toonSlug);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://toonstream.us/',
};

async function test() {
  const slugCandidates = [
    series.toonSlug,
    series.slug,
    series.saltSlug,
  ].filter(Boolean);
  
  console.log('Slug candidates:', slugCandidates);

  for (const slug of slugCandidates) {
    const url = 'https://toonstream.us/series/' + slug + '/';
    console.log('Trying:', url);
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
      console.log('Status:', res.status);
      const html = await res.text();
      const hasEp = html.includes('/episode/');
      const has404 = html.includes('404') || html.includes('Page not found');
      console.log('Has /episode/:', hasEp, 'Has 404:', has404, 'HTML len:', html.length);
      if (html && !has404 && hasEp) {
        console.log('FOUND!');
        const $ = cheerio.load(html);
        const eps = [];
        $('a[href*="/episode/"]').each((_, el) => eps.push($(el).attr('href')));
        console.log('Episode count:', eps.length, 'First 3:', eps.slice(0, 3));
        break;
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

test().catch(console.error);
