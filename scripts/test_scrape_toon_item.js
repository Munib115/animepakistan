const cheerio = require('cheerio');

async function testSingleItem() {
  // Test movie
  const movieUrl = 'https://toon-stream.site/movies/death-note-relight-1-visions-of-a-god/';
  const res = await fetch(movieUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('h1.entry-title, h1').first().text().trim();
  const desc = $('.entry-content p, .description p, .synopsis').first().text().trim();
  const poster = $('img.attachment-post-thumbnail, .poster img').first().attr('src') || $('img.attachment-post-thumbnail, .poster img').first().attr('data-src');
  
  // Find embed
  let embed = $('iframe[src*="/embed/"]').attr('src') || $('iframe[data-src*="/embed/"]').attr('data-src');
  if (embed && !embed.startsWith('http')) {
    embed = `https://toon-stream.site${embed}`;
  }

  console.log('Scraped Movie:', {
    title,
    desc: desc.slice(0, 100),
    poster,
    embed
  });
}

testSingleItem();
