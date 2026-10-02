const db = require('../src/data/anime-db.json');

let totalMovies = 0;
let moviesWithStreams = 0;
let totalSeries = 0;
let totalEpisodes = 0;
let episodesWithStreams = 0;
const labelsCount = {};
const hostsCount = {};

for (const item of db) {
  if (item.type === 'movie') {
    totalMovies++;
    if (item.streamSources && item.streamSources.length > 0) {
      moviesWithStreams++;
      for (const s of item.streamSources) {
        const lbl = s.label || s.server || s.language || 'Default';
        labelsCount[lbl] = (labelsCount[lbl] || 0) + 1;
        try {
          const host = new URL(s.url).hostname;
          hostsCount[host] = (hostsCount[host] || 0) + 1;
        } catch {}
      }
    }
  } else {
    totalSeries++;
    if (item.episodes) {
      for (const ep of item.episodes) {
        totalEpisodes++;
        if (ep.streamSources && ep.streamSources.length > 0) {
          episodesWithStreams++;
          for (const s of ep.streamSources) {
            const lbl = s.label || s.server || s.language || 'Default';
            labelsCount[lbl] = (labelsCount[lbl] || 0) + 1;
            try {
              const host = new URL(s.url).hostname;
              hostsCount[host] = (hostsCount[host] || 0) + 1;
            } catch {}
          }
        }
      }
    }
  }
}

console.log('=== OVERALL DATABASE HEALTH & COVERAGE ===');
console.log(`Total Titles: ${db.length}`);
console.log(`Movies: ${moviesWithStreams} / ${totalMovies} (${((moviesWithStreams / totalMovies) * 100).toFixed(1)}%)`);
console.log(`Series: ${totalSeries}`);
console.log(`Episodes: ${episodesWithStreams} / ${totalEpisodes} (${((episodesWithStreams / totalEpisodes) * 100).toFixed(1)}%)`);
console.log('\n=== Stream Labels Distribution ===');
console.log(labelsCount);
console.log('\n=== Top Stream Hosts Distribution ===');
console.log(Object.entries(hostsCount).sort((a, b) => b[1] - a[1]).slice(0, 15));
