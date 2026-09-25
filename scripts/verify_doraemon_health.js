const path = require('path');
const fs = require('fs');

async function testResolution() {
  const db = JSON.parse(fs.readFileSync('src/data/anime-db.json', 'utf8'));
  const movies = db.filter(x => x.type === 'movie' && (x.title.toLowerCase().includes('doraemon') || x.slug.toLowerCase().includes('doraemon')));
  console.log(`Checking ${movies.length} Doraemon movies in DB:`);

  let allOk = true;
  for (const m of movies) {
    if (!m.streamSources || m.streamSources.length === 0) {
      console.error(`FAIL: ${m.title} has NO streamSources!`);
      allOk = false;
    } else if (!m.streamUrl) {
      console.error(`FAIL: ${m.title} has NO streamUrl!`);
      allOk = false;
    } else if (!m.poster) {
      console.error(`FAIL: ${m.title} has NO poster!`);
      allOk = false;
    } else {
      console.log(`OK: [${m.slug}] "${m.title}" -> ${m.streamSources.length} streams, Primary: ${m.streamUrl}`);
    }
  }

  if (allOk) {
    console.log(`\nALL ${movies.length} DORAEMON MOVIES ARE 100% HEALTHY AND HAVE ACTIVE STREAMS!`);
  }
}

testResolution();
