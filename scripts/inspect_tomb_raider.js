const cheerio = require('cheerio');

async function checkTR() {
  const url = 'https://animesalt.cx/episode/tomb-raider-king-1x2/';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  $('iframe').each((i, el) => {
    console.log('iframe:', $(el).attr('src'), $(el).attr('data-src'));
  });
}
checkTR();
