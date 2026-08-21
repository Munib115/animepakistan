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

async function inspectMha() {
  console.log('Inspecting https://animesalt.link/series/my-hero-academia/ ...');
  const html = await fetchUrl('https://animesalt.link/series/my-hero-academia/');
  console.log('HTML length:', html.length);
  
  // Look for season tabs, buttons, episode links
  const seasonMatches = [...html.matchAll(/season[^"'>\s]*/gi)].map(m => m[0]);
  console.log('Season keywords in html (first 20):', seasonMatches.slice(0, 20));

  // Look for episode links in HTML
  const epLinks = [...html.matchAll(/href="([^"]*(?:episode|watch|private|season)[^"]*)"/gi)].map(m => m[1]);
  console.log('Found episode-like hrefs:', epLinks.length);
  console.log(epLinks.slice(0, 30));

  // Look for seasons dropdown / container
  const seasonBlocks = [...html.matchAll(/<div[^>]*class="[^"]*(?:season|episod|tab)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)].map(m => m[0]);
  console.log(`Found ${seasonBlocks.length} season/episode blocks`);
  for (let i = 0; i < Math.min(5, seasonBlocks.length); i++) {
    console.log(`Block ${i}:`, seasonBlocks[i].substring(0, 200));
  }
}

inspectMha().catch(console.error);
