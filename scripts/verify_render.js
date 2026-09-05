const cheerio = require('cheerio');

async function test() {
  const res = await fetch('http://localhost:3000/watch/tomb-raider-king/tomb-raider-king-1x2');
  const html = await res.text();
  const $ = cheerio.load(html);
  const iframes = [];
  $('iframe').each((i, el) => {
    iframes.push($(el).attr('src'));
  });
  console.log('iframes:', iframes);
  const match = html.match(/as-cdn\d+\.top\/video\/[a-f0-9]+/);
  console.log('as-cdn match:', match ? match[0] : 'None');
  const shortIcu = html.match(/short\.icu/);
  console.log('short.icu found:', shortIcu ? 'YES (BAD)' : 'NO (GOOD)');
}
test();
