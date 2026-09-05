const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('scratch_jojo_ep1.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- IFRAMES ---');
$('iframe').each((i, el) => {
  console.log('iframe:', $(el).attr('src'), $(el).attr('data-src'));
});

console.log('--- EMBED / PLAYER ELEMENTS ---');
$('[data-player], [data-embed], .playex, [data-src]').each((i, el) => {
  const ds = $(el).attr('data-src');
  const dp = $(el).attr('data-player');
  const de = $(el).attr('data-embed');
  if (ds || dp || de) {
    console.log({ tag: el.tagName, ds, dp, de });
  }
});

console.log('--- SERVERS / BUTTONS ---');
$('.server-btn, .servers, .btn-server, [data-server], .aa-tbs-video li').each((i, el) => {
  console.log('server:', $(el).text().trim(), $(el).attr('data-server'), $(el).attr('data-src'), $(el).attr('data-post'));
});

console.log('--- SCRIPT SEARCH FOR STREAM LINKS OR AS-CDN ---');
$('script').each((i, el) => {
  const c = $(el).html() || '';
  if (c.includes('video') || c.includes('player') || c.includes('as-cdn') || c.includes('stream') || c.includes('m3u8')) {
    console.log('script chunk:', c.slice(0, 300));
  }
});
