const cheerio = require('cheerio');

async function testEp() {
  const url = 'https://animesalt.link/episode/private-rascal-does-not-dream-of-bunny-girl-senpai-2x1/';
  console.log('Fetching:', url);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  console.log('Status:', res.status);
  const $ = cheerio.load(html);
  console.log('Title:', $('title').text());
  console.log('H1:', $('h1').text());
  
  console.log('\n--- IFRAMES ---');
  $('iframe').each((i, el) => {
    console.log(i, 'src:', $(el).attr('src'), '| data-src:', $(el).attr('data-src'));
  });

  console.log('\n--- PLAYER SERVERS / TABS / BUTTONS ---');
  $('[class*="server"], [class*="option"], [class*="source"], [id*="player"], .playex, .dooplay_player_option').each((i, el) => {
    console.log(i, el.tagName, el.attribs, $(el).text().trim());
  });

  console.log('\n--- SCRIPT TAGS ---');
  $('script').each((i, el) => {
    const txt = $(el).html() || '';
    if (txt.includes('player') || txt.includes('iframe') || txt.includes('embed') || txt.includes('source') || txt.includes('eval') || txt.includes('as-cdn') || txt.includes('m3u8')) {
      console.log(`\nScript #${i}:\n`, txt.slice(0, 800));
    }
  });
}

testEp().catch(console.error);
