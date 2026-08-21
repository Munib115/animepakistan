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

async function inspectTorofilm() {
  const code = await fetchUrl('https://animesalt.link/wp-content/themes/torofilm/public/js/torofilm-public.js?ver=1786459287');
  const idx = code.indexOf('lastSeasonSelected_');
  console.log(code.substring(Math.max(0, idx - 200), idx + 1200));
}

inspectTorofilm().catch(console.error);
