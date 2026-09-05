const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('scratch_toonstream.html', 'utf8');
const $ = cheerio.load(html);

// Find all links that go to an anime or series or episode or post
const links = [];
$('a').each((i, el) => {
  const href = $(el).attr('href');
  const text = $(el).text().trim();
  if (href && !href.startsWith('#') && !href.includes('page/') && !href.includes('category/')) {
    links.push({ href, text, class: $(el).attr('class') });
  }
});

console.log('Sample links found on toon-stream anime page:');
console.log(links.slice(0, 30));

// Find max page in pagination
const pages = [];
$('.page-link').each((i, el) => {
  pages.push({ text: $(el).text().trim(), href: $(el).attr('href') });
});
console.log('Pagination links:', pages);
