const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('scratch_as_cdn.html', 'utf8');
const $ = cheerio.load(html);

$('script').each((i, el) => {
  const content = $(el).html() || '';
  if (content.trim()) {
    console.log('Script ' + i + ':');
    console.log(content);
    console.log('---------------------------');
  }
});
