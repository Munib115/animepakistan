const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('scratch_ruby.html', 'utf8');
const $ = cheerio.load(html);

$('script').each((i, el) => {
  const c = $(el).html() || '';
  if (c.trim()) {
    console.log('Script ' + i + ':');
    console.log(c.slice(0, 500));
    console.log('----------------');
  }
});
