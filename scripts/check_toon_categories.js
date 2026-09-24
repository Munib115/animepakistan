const cheerio = require('cheerio');

async function checkCategory(cat) {
  const url = `https://toonstream.us/category/${cat}?type=all&page=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  // Check pagination
  let maxPage = 1;
  $('.pagination a, .pages a, .nav-links a, a.page-link').each((_, el) => {
    const num = parseInt($(el).text().trim(), 10);
    if (!isNaN(num) && num > maxPage) maxPage = num;
  });

  const items = [];
  $('article, .item, .poster-item').each((_, el) => {
    const link = $(el).find('a[href*="/series/"], a[href*="/movies/"]').attr('href');
    const title = $(el).find('h2, h3, .entry-title, .title').text().trim();
    if (link && !items.some(x => x.link === link)) items.push({ link, title });
  });

  console.log(`[${cat}] Page 1 items: ${items.length}, max page link found: ${maxPage}`);
  return { cat, maxPage, sampleItems: items.slice(0, 5) };
}

async function run() {
  await checkCategory('anime');
  await checkCategory('cartoon');
  await checkCategory('movies');
}

run();
