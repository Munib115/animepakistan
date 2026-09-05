const cheerio = require('cheerio');

async function testEpisodes() {
  const urls = [
    'https://animesalt.cx/episode/devil-may-cry-1x1/',
    'https://animesalt.cx/episode/devil-may-cry-1x2/',
    'https://animesalt.cx/episode/dragon-ball-daima-1x1/',
    'https://animesalt.cx/episode/solo-leveling-1x1/',
    'https://animesalt.cx/episode/naruto-shippuden-1x1/'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      const html = await res.text();
      const $ = cheerio.load(html);
      const iframes = [];
      $('iframe').each((_, el) => {
        iframes.push({
          src: $(el).attr('src'),
          dataSrc: $(el).attr('data-src')
        });
      });
      console.log('URL:', u);
      console.log(iframes);
      console.log('-----------------------------------');
    } catch (e) {
      console.log(u, 'ERR:', e.message);
    }
  }
}
testEpisodes();
