const cheerio = require('cheerio');

async function run() {
  const res = await fetch('https://toonstream.us/home', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  console.log('Homepage Title:', $('title').text());

  const eps = [];
  $('a[href*="/episode/"]').each((_, el) => {
    const h = $(el).attr('href');
    if (h && !eps.includes(h)) eps.push(h);
  });
  console.log(`Found ${eps.length} fresh episode links:`);
  console.log(eps.slice(0, 15));

  const series = [];
  $('a[href*="/series/"]').each((_, el) => {
    const h = $(el).attr('href');
    if (h && !series.includes(h)) series.push(h);
  });
  console.log(`Found ${series.length} series links on home:`);
  console.log(series.slice(0, 10));

  const movies = [];
  $('a[href*="/movies/"]').each((_, el) => {
    const h = $(el).attr('href');
    if (h && !movies.includes(h)) movies.push(h);
  });
  console.log(`Found ${movies.length} movie links on home:`);
  console.log(movies.slice(0, 10));
}

run();
