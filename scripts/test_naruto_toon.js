const cheerio = require('cheerio');

async function test() {
  const res = await fetch('https://toonstream.us/series/naruto/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const eps = [];
  $('a[href*="/episode/"]').each((_, el) => { eps.push($(el).attr('href')); });
  console.log('Status:', res.status);
  console.log('Episode links found:', eps.length);
  console.log('First 5:', eps.slice(0, 5));
  
  // Also check if there's a season list
  const seasons = [];
  $('a[href*="/season-"]').each((_, el) => { seasons.push($(el).attr('href')); });
  console.log('Season links:', seasons.slice(0, 5));
  
  // Check if page has episode content at all
  const hasEpContent = html.includes('episode') || html.includes('Episode');
  console.log('Has episode content:', hasEpContent);
  console.log('HTML length:', html.length);
}

test().catch(console.error);
