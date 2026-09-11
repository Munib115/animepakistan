const cheerio = require('cheerio');

async function testSites() {
  console.log('--- Checking AnimeSalt.cx latest ---');
  try {
    const res = await fetch('https://animesalt.cx/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.cx/'
      },
      signal: AbortSignal.timeout(12000)
    });
    console.log('AnimeSalt HTTP status:', res.status);
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log('AnimeSalt Title:', $('title').text().trim());

    console.log('\n--- Recent Episodes on AnimeSalt Homepage ---');
    $('article.episodes, .episodes article, .post-episode, article').slice(0, 15).each((i, el) => {
      const title = $(el).find('.entry-title, .title, h2, h3').text().trim();
      const link = $(el).find('a').attr('href');
      const epNum = $(el).find('.num-epi').text().trim();
      if (link && link.includes('animesalt')) {
        console.log(`[Salt #${i+1}] ${title} ${epNum ? `(Ep: ${epNum})` : ''} -> ${link}`);
      }
    });

    console.log('\n--- Checking AnimeSalt /series/ page ---');
    const seriesRes = await fetch('https://animesalt.cx/series/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(12000)
    });
    const sHtml = await seriesRes.text();
    const $s = cheerio.load(sHtml);
    console.log('AnimeSalt Series count:', $s('article').length);
    $s('article').slice(0, 10).each((i, el) => {
      const title = $s(el).find('.entry-title, .title, h2, h3').text().trim();
      const link = $s(el).find('a').attr('href');
      console.log(`[Salt Series #${i+1}] ${title} -> ${link}`);
    });
  } catch (err) {
    console.error('AnimeSalt error:', err.message);
  }

  console.log('\n--- Checking ToonStream latest ---');
  try {
    const res2 = await fetch('https://toon-stream.site/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://toon-stream.site/'
      },
      signal: AbortSignal.timeout(12000)
    });
    console.log('ToonStream HTTP status:', res2.status);
    const html2 = await res2.text();
    const $2 = cheerio.load(html2);
    console.log('ToonStream Title:', $2('title').text().trim());
    console.log('\n--- Recent Releases on ToonStream ---');
    $2('article, .post, .item, [class*="item"]').slice(0, 15).each((i, el) => {
      const title = $2(el).find('h2, h3, .title, .entry-title').first().text().trim() || $2(el).find('img').attr('alt');
      const link = $2(el).find('a').attr('href');
      if (link && (link.includes('/series/') || link.includes('/movies/') || link.includes('/episode/'))) {
        console.log(`[Toon #${i+1}] ${title} -> ${link}`);
      }
    });

    console.log('\n--- Checking ToonStream /category/anime page ---');
    const toonCatRes = await fetch('https://toon-stream.site/category/anime?type=all&page=1', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(12000)
    });
    const tHtml = await toonCatRes.text();
    const $t = cheerio.load(tHtml);
    $t('article, .item').slice(0, 10).each((i, el) => {
      const title = $t(el).find('h2, h3, .title').first().text().trim() || $t(el).find('img').attr('alt');
      const link = $t(el).find('a').attr('href');
      if (link) console.log(`[Toon Anime #${i+1}] ${title} -> ${link}`);
    });
  } catch (err) {
    console.error('ToonStream error:', err.message);
  }
}

testSites();
