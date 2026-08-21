const cheerio = require('cheerio');

async function checkSeries() {
  const url = 'https://animesalt.link/series/rascal-does-not-dream-of-bunny-girl-senpai/';
  console.log('Fetching:', url);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  console.log('H1:', $('h1').text());
  console.log('Episodes count:', $('article.episodes').length);
  $('article.episodes').each((i, el) => {
    const link = $(el).find('a.lnk-blk').attr('href');
    const title = $(el).find('.entry-title').text().trim();
    const num = $(el).find('.num-epi').text().trim();
    console.log(`Episode #${num}: "${title}" -> ${link}`);
  });
}

checkSeries().catch(console.error);
