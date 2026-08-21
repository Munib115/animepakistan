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

async function inspectThemeJs() {
  const html = await fetchUrl('https://animesalt.link/series/my-hero-academia/');
  const jsUrls = [...html.matchAll(/src="([^"]*(?:public|frontend|scripts|main|functions|theme)[^"]*\.js[^"]*)"/gi)].map(m => m[1]);
  console.log('Theme JS files:', jsUrls);

  for (const u of jsUrls) {
    try {
      const code = await fetchUrl(u);
      if (code.includes('action') && (code.includes('season') || code.includes('post'))) {
        console.log(`\n--- Found season action in ${u}: ---`);
        // Find ajax calls in this code
        const matches = [...code.matchAll(/action:\s*['"][^'"]+['"]/g)].map(m => m[0]);
        console.log('Action matches:', matches);
        
        // Print snippet around season
        const seasonIdx = code.indexOf('season');
        if (seasonIdx !== -1) {
          console.log(code.substring(Math.max(0, seasonIdx - 100), seasonIdx + 300));
        }
      }
    } catch (e) {
      console.error('Error fetching JS:', u, e.message);
    }
  }
}

inspectThemeJs().catch(console.error);
