const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let totalSeries = 0;
let totalMovies = 0;
let totalEpisodes = 0;

let playableEpisodes = 0;
let episodesWithToonStream = 0;
let episodesWithMultipleSources = 0;

let playableMovies = 0;
let moviesWithToonStream = 0;
let moviesWithMultipleSources = 0;

const hostCounts = {};

function getHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'invalid-url';
  }
}

db.forEach(item => {
  if (item.type === 'movie') {
    totalMovies++;
    const hasSource = (item.streamSources && item.streamSources.length > 0) || (item.streamUrl && item.streamUrl.length > 5);
    if (hasSource) {
      playableMovies++;
      if (item.streamSources && item.streamSources.length > 1) moviesWithMultipleSources++;

      const primary = item.streamSources?.[0]?.url || item.streamUrl;
      const host = getHost(primary);
      hostCounts[host] = (hostCounts[host] || 0) + 1;

      if (primary && (primary.includes('ruby') || primary.includes('abyss') || primary.includes('filesforever') || primary.includes('toonstream') || primary.includes('cloudy') || primary.includes('strmup') || primary.includes('emturbovid'))) {
        moviesWithToonStream++;
      }
    }
  } else {
    totalSeries++;
    const episodes = item.episodes || [];
    totalEpisodes += episodes.length;

    episodes.forEach(ep => {
      const hasSource = (ep.streamSources && ep.streamSources.length > 0) || (ep.streamUrl && ep.streamUrl.length > 5);
      if (hasSource) {
        playableEpisodes++;
        if (ep.streamSources && ep.streamSources.length > 1) episodesWithMultipleSources++;

        const primary = ep.streamSources?.[0]?.url || ep.streamUrl;
        const host = getHost(primary);
        hostCounts[host] = (hostCounts[host] || 0) + 1;

        if (primary && (primary.includes('ruby') || primary.includes('abyss') || primary.includes('filesforever') || primary.includes('toonstream') || primary.includes('cloudy') || primary.includes('strmup') || primary.includes('emturbovid'))) {
          episodesWithToonStream++;
        }
      }
    });
  }
});

console.log('====================================');
console.log('       ANIMEPAKISTAN STREAM AUDIT    ');
console.log('====================================');
console.log(`Total Database Titles: ${db.length}`);
console.log(`  - Series: ${totalSeries}`);
console.log(`  - Movies: ${totalMovies}`);
console.log('------------------------------------');
console.log(`Total Episodes: ${totalEpisodes}`);
console.log(`Playable Episodes: ${playableEpisodes} (${((playableEpisodes / totalEpisodes) * 100).toFixed(1)}%)`);
console.log(`Episodes on ToonStream HD/Fast Mirrors: ${episodesWithToonStream}`);
console.log(`Episodes with Multi-Mirrors: ${episodesWithMultipleSources}`);
console.log('------------------------------------');
console.log(`Playable Movies: ${playableMovies} of ${totalMovies} (${((playableMovies / totalMovies) * 100).toFixed(1)}%)`);
console.log(`Movies on ToonStream HD/Fast Mirrors: ${moviesWithToonStream}`);
console.log('------------------------------------');
console.log('Primary Host Breakdown (Across All Working Video Streams):');
Object.entries(hostCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([host, count]) => {
    console.log(`  - ${host}: ${count} streams`);
  });
console.log('====================================');

// Sample test 10 random playable streams for live HTTP reachability
async function checkUrl(url) {
  return new Promise(resolve => {
    try {
      const parsed = new URL(url);
      const req = (parsed.protocol === 'https:' ? https : http).request(
        parsed,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://toonstream.us/'
          },
          timeout: 4000
        },
        res => {
          resolve(res.statusCode);
        }
      );
      req.on('error', err => resolve(`ERR: ${err.message}`));
      req.on('timeout', () => { req.destroy(); resolve('TIMEOUT'); });
      req.end();
    } catch (e) {
      resolve(`FAIL: ${e.message}`);
    }
  });
}

async function runLiveSample() {
  console.log('\nTesting Live HTTP Status for Top Playable Titles:');
  const samples = [
    { title: 'Spy x Family Ep 1', slug: 'spy-x-family' },
    { title: 'Naruto Ep 1', slug: 'naruto' },
    { title: 'Jujutsu Kaisen Ep 1', slug: 'jujutsu-kaisen' },
    { title: 'Dragon Ball Z Ep 1', slug: 'dragon-ball-z' },
    { title: 'Doraemon Ep 1', slug: 'doraemon' },
    { title: 'Solo Leveling Ep 1', slug: 'solo-leveling' },
    { title: 'Demon Slayer Ep 1', slug: 'demon-slayer-kimetsu-no-yaiba' },
    { title: 'One Piece Ep 1', slug: 'one-piece' }
  ];

  for (const s of samples) {
    const item = db.find(d => d.slug === s.slug) || db.find(d => d.slug.includes(s.slug));
    if (item) {
      const ep = item.episodes?.[0];
      const stream = ep?.streamSources?.[0]?.url || ep?.streamUrl || item.streamUrl;
      if (stream) {
        const status = await checkUrl(stream);
        console.log(`  [${s.title}] (${getHost(stream)}) -> HTTP ${status} (URL: ${stream.substring(0, 45)}...)`);
      } else {
        console.log(`  [${s.title}] No stream URL found`);
      }
    } else {
      console.log(`  [${s.title}] Title not found in DB`);
    }
  }
}

runLiveSample();
