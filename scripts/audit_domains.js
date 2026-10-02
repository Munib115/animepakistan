const db = require('../src/data/anime-db.json');

const hosts = {};
function record(url) {
  try {
    const host = new URL(url).hostname;
    if (!hosts[host]) hosts[host] = [];
    if (hosts[host].length < 3) hosts[host].push(url);
  } catch(e) {}
}

for (const a of db) {
  if (a.streamSources) a.streamSources.forEach(s => record(s.url));
  if (a.episodes) a.episodes.forEach(ep => {
    if (ep.streamSources) ep.streamSources.forEach(s => record(s.url));
  });
}

async function checkSingle(host, urls) {
  const url = urls[0];
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://animesalt.cx/'
      },
      signal: controller.signal
    });
    clearTimeout(t);
    return { host, status: res.status, alive: res.status < 500 };
  } catch(e) {
    return { host, status: 'ERR', message: e.message, alive: false };
  }
}

async function main() {
  const tasks = Object.entries(hosts).map(([host, urls]) => checkSingle(host, urls));
  const results = await Promise.all(tasks);
  const dead = results.filter(r => !r.alive);
  const alive = results.filter(r => r.alive);
  console.log('=== DEAD DOMAINS (' + dead.length + ') ===');
  dead.forEach(d => console.log(`${d.host}: ${d.status} (${d.message || ''})`));
  console.log('\n=== ALIVE DOMAINS (' + alive.length + ') ===');
  alive.forEach(a => console.log(`${a.host}: ${a.status}`));
}

main().catch(console.error);
