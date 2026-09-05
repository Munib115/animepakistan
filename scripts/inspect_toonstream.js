const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('scratch_toonstream.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- TITLE ---');
console.log($('title').text());

console.log('--- POSTS / ANIME ITEMS ---');
const items = [];
$('article, .post, .item, .entry, [class*="post"], [class*="item"]').each((i, el) => {
  const link = $(el).find('a').attr('href');
  const title = $(el).find('h2, h3, .title, a').first().text().trim();
  const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
  if (link && title && link.includes('toon-stream.site') && !items.some(x => x.link === link)) {
    items.push({ title, link, img });
  }
});
console.log(`Found ${items.length} items on page 1:`);
console.log(items.slice(0, 10));

console.log('--- PAGINATION ---');
$('.pagination, .nav-links, .page-numbers, [class*="pagination"]').each((i, el) => {
  console.log('Pagination element:', $(el).html()?.slice(0, 500));
});

// Look for max page
const pageLinks = [];
$('a').each((i, el) => {
  const href = $(el).attr('href') || '';
  if (href.includes('/category/anime/page/') || href.includes('/page/')) {
    pageLinks.push(href);
  }
});
console.log('Page links:', [...new Set(pageLinks)]);
