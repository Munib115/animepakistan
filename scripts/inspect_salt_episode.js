const https = require('https');

function get(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d }));
    }).on('error', e => resolve({ status: 500, data: '' }));
  });
}

async function run() {
  const page = await get('https://animesalt.cx/episode/devil-may-cry-1x1/');
  console.log('Page status:', page.status, 'len:', page.data.length);

  // Look for iframes
  const iframes = page.data.match(/<iframe[^>]+src=["']([^"']+)["']/gi) || [];
  console.log('Iframes:', iframes);

  // Look for embed or player buttons
  const players = page.data.match(/<a[^>]+class=["'][^"']*player[^"']*["'][^>]*>[\s\S]*?<\/a>/gi) || [];
  console.log('Player buttons:', players.slice(0, 5));

  // Look for data-post, data-type, data-opt
  const dataOpts = page.data.match(/data-[a-z0-9_-]+=["'][^"']+["']/gi) || [];
  const uniqueOpts = Array.from(new Set(dataOpts)).filter(o => o.includes('post') || o.includes('id') || o.includes('opt') || o.includes('url') || o.includes('embed') || o.includes('stream'));
  console.log('Data attributes:', uniqueOpts);

  // Look for scripts with ajaxurl or wp-json or api
  const scripts = page.data.match(/<script[\s\S]*?<\/script>/gi) || [];
  scripts.forEach((s, idx) => {
    if (s.includes('ajax') || s.includes('api') || s.includes('player') || s.includes('video') || s.includes('wp-admin') || s.includes('action')) {
      console.log(`\n--- Script ${idx} ---`);
      console.log(s.slice(0, 500));
    }
  });
}

run();
