const cheerio = require('cheerio');

async function testPage(url) {
  console.log(`\nTesting ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://toonstream.us/'
    }
  });
  console.log('Status:', res.status);
  const html = await res.text();
  const $ = cheerio.load(html);

  const iframes = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (s && !iframes.includes(s)) iframes.push(s);
  });
  console.log('Direct iframes found:', iframes);

  // Check data-post or ajax player buttons / servers
  const serverTabs = [];
  $('[data-post], [data-server], [data-embed], .play-button, .server-item, .opt-server, li[id*="player"]').each((_, el) => {
    const text = $(el).text().trim();
    const data = $(el).data() || {};
    const attrs = el.attribs;
    serverTabs.push({ text, attrs });
  });
  console.log('Server tabs / buttons count:', serverTabs.length);
  if (serverTabs.length > 0) {
    console.log('First 5 server tabs:', JSON.stringify(serverTabs.slice(0, 5), null, 2));
  }
}

async function run() {
  await testPage('https://toonstream.us/episode/jojos-bizarre-adventure-6x1/');
  await testPage('https://toonstream.us/movies/demon-slayer-kimetsu-no-yaiba-infinity-castle/');
}

run();
