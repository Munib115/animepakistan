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

async function inspectSeasonButtons() {
  const html = await fetchUrl('https://animesalt.link/series/my-hero-academia/');
  
  // Find all season buttons
  const buttons = [...html.matchAll(/<a[^>]*class="[^"]*season-btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  console.log(`Found ${buttons.length} season buttons:`);
  for (const b of buttons) {
    console.log(b[0]);
  }

  // Search for AJAX endpoint or script handling season-btn
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  for (const s of scripts) {
    if (s.includes('season') || s.includes('admin-ajax')) {
      console.log('\n--- Script with season/ajax: ---');
      console.log(s.substring(0, 500));
    }
  }
}

inspectSeasonButtons().catch(console.error);
