const cheerio = require('cheerio');
const fs = require('fs');

const db = require('../src/data/anime-db.json');

async function testVarious() {
  const sampleItems = [
    db.find(x => x.slug.includes('naruto')),
    db.find(x => x.slug.includes('death-note')),
    db.find(x => x.slug.includes('chainsaw-man')),
    db.find(x => x.slug.includes('cells-at-work')),
    db.find(x => x.type === 'movie'),
    db.find(x => x.slug.includes('jujutsu') || x.slug.includes('attack-on-titan')),
  ].filter(Boolean);

  for (const item of sampleItems) {
    console.log('\n========================================');
    console.log('Testing anime:', item.title, 'Type:', item.type);
    let targetUrl = item.url;
    if (item.type === 'series' && item.episodes && item.episodes.length > 0) {
      targetUrl = item.episodes[0].url;
    }
    console.log('Target URL:', targetUrl);

    try {
      const res = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const html = await res.text();
      const $ = cheerio.load(html);
      
      console.log('Title in HTML:', $('h1').text().trim() || $('title').text().trim());

      $('iframe').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        console.log(`  Iframe #${i}:`, src);
      });

      $('[data-player], [data-embed], .playex, [class*="server"]').each((i, el) => {
        console.log(`  Element:`, el.tagName, el.attribs);
      });
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

testVarious().catch(console.error);
