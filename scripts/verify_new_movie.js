const cheerio = require('cheerio');

async function test() {
  const res = await fetch('http://localhost:3000/watch/x-men/x-men-1x1');
  const html = await res.text();
  const $ = cheerio.load(html);
  const iframes = [];
  $('iframe').each((i, el) => iframes.push($(el).attr('src')));
  console.log('Status:', res.status, 'iframes:', iframes);
}
test();
