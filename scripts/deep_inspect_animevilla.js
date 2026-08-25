const cheerio = require('cheerio');

async function deepInspect() {
  const urls = [
    'https://animevilla.org/watch/demon-slayer-infinity-castle-movie-hindi-dubbed/',
    'https://animevilla.org/watch/watch-suzume-movie-2022-hindi/',
    'https://animevilla.org/anime/naruto-hindi-dubbed/',
    'https://animevilla.org/anime/death-note-hindi-dubbed-watch/',
    'https://animevilla.org/anime/solo-leveling-hindi-dubbed-watch-1/',
    'https://animevilla.org/anime/solo-leveling-season-2-hindi-dubbed-watch-1/',
    'https://animevilla.org/anime/jujutsu-kaisen-season-2-hindi-dubbed-23/',
    'https://animevilla.org/anime/attack-on-titan-season-4-hindi-dubbed/',
    'https://animevilla.org/anime/doraemon-the-movie-nobitas-three-visionary-swordsmen-hindi-dubbed/'
  ];

  for (const url of urls) {
    console.log('\n======================================================');
    console.log('Inspecting:', url);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://animevilla.org/'
        }
      });
      console.log('Status:', res.status);
      const html = await res.text();
      const $ = cheerio.load(html);

      console.log('Title:', $('title').text());

      // Iframes
      $('iframe').each((i, el) => {
        console.log(`  [Iframe ${i+1}]:`, $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-player'));
      });

      // Links with streaming / video keywords
      const streamLinks = [];
      $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim().replace(/\s+/g, ' ');
        if (href && (href.includes('stream') || href.includes('player') || href.includes('video') || href.includes('watch') || href.includes('hsa') || href.includes('drive') || href.includes('mega') || href.includes('fastdl'))) {
          streamLinks.push({ text, href });
        }
      });

      console.log(`  Stream / Video links found: ${streamLinks.length}`);
      streamLinks.slice(0, 10).forEach(l => console.log(`    - [${l.text}] -> ${l.href}`));

      // Check all script tags for player configurations / m3u8 / embed / sources
      let foundScriptInfo = false;
      $('script').each((i, el) => {
        const src = $(el).attr('src') || '';
        const content = $(el).html() || '';
        if (src.includes('player') || src.includes('video') || src.includes('embed') || content.includes('sources') || content.includes('file:') || content.includes('stream')) {
          console.log(`  [Script ${i}] (src: ${src}):`);
          if (content) {
            console.log('    Content snippet:', content.substring(0, 300).replace(/\n/g, ' '));
          }
          foundScriptInfo = true;
        }
      });

    } catch(e) {
      console.error('Error:', e.message);
    }
  }
}

deepInspect();
