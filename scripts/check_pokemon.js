const cheerio = require('cheerio');

async function checkPokemon() {
  const url = 'https://animesalt.cx/episode/pokemon-the-series-ruby-and-sapphire-6x1/';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
  console.log('Status:', res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  $('iframe').each((i, el) => {
    console.log('iframe:', $(el).attr('src'), $(el).attr('data-src'));
  });
}
checkPokemon();
