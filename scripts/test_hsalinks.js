const cheerio = require('cheerio');

async function testHubcloud() {
  const url = 'https://hubcloud.ist/video/p24fxnshva2thmg';
  console.log('Testing HubCloud:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://hsalinks.in/'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('HTML length:', html.length);
    const $ = cheerio.load(html);
    console.log('Title:', $('title').text());
    
    // Check iframes and video player elements
    $('iframe, video, source').each((i, el) => {
      console.log(`  [${el.tagName}]:`, $(el).attr('src') || $(el).attr('data-src'));
    });

    $('a[href]').each((i, el) => {
      const h = $(el).attr('href');
      const t = $(el).text().trim().replace(/\s+/g, ' ');
      if (h && (h.includes('stream') || h.includes('m3u8') || h.includes('mp4') || h.includes('video') || h.includes('download') || h.includes('watch') || h.includes('player'))) {
        console.log(`  Link: [${t}] -> ${h}`);
      }
    });
  } catch(e) {
    console.error('Error:', e.message);
  }
}

testHubcloud();
