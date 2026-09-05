const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('scratch_dmc.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- IFRAMES ---');
$('iframe').each((i, el) => {
  console.log('iframe:', $(el).attr('src'), $(el).attr('data-src'), $(el).attr('class'), $(el).attr('id'));
});

console.log('--- PLAYEX / PLAYERS ---');
$('[data-player], [data-embed], .playex, [data-src]').each((i, el) => {
  const ds = $(el).attr('data-src');
  const dp = $(el).attr('data-player');
  const de = $(el).attr('data-embed');
  const tag = el.tagName;
  console.log('player el:', { tag, ds, dp, de, class: $(el).attr('class'), id: $(el).attr('id') });
});

console.log('--- SERVERS / BUTTONS ---');
$('.server-btn, .servers, .btn-server, [data-server]').each((i, el) => {
  console.log('server el:', $(el).text().trim(), $(el).attr('data-server'), $(el).attr('data-src'), $(el).attr('data-post'));
});

console.log('--- SCRIPT SEARCH FOR as-cdn or ajax ---');
$('script').each((i, el) => {
  const c = $(el).html() || '';
  if (c.includes('as-cdn') || c.includes('admin-ajax') || c.includes('action:')) {
    console.log('script chunk:', c.slice(0, 500));
  }
});
