const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function testSeasonAjax() {
  console.log('Fetching My Hero Academia Season 2 via admin-ajax.php...');
  const url = 'https://animesalt.link/wp-admin/admin-ajax.php?action=action_select_season&season=2&post=52';
  const html = await fetchUrl(url);
  console.log('HTML length:', html.length);
  console.log('Sample HTML:', html.substring(0, 800));

  // Extract episodes
  const epLinks = [...html.matchAll(/<a[^>]*href="([^"]*\/episode\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
  console.log(`Extracted ${epLinks.length} episodes for Season 2:`);
  for (const ep of epLinks) {
    console.log(ep[1]);
  }
}

testSeasonAjax().catch(console.error);
