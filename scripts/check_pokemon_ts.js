const cheerio = require('cheerio');

async function searchPokemon() {
  const res = await fetch('https://toon-stream.site/?s=pokemon', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/series/pokemon')) items.push(href);
  });
  console.log('Pokemon series on toon-stream:', [...new Set(items)]);
}
searchPokemon();
