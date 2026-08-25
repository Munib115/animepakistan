/**
 * Patch unmatched watch page stream URLs into the DB
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

function findBySlugKeyword(keyword) {
  return db.filter(a => a.slug.toLowerCase().includes(keyword.toLowerCase()));
}

// Direct mappings: [watchPageSlug, dbSlug/keyword, episodeNumber]
const EPISODE_MAPPINGS = [
  // The Share House's Secret Rule - episodes 1-8
  ['the-share-houses-secret-rule-hindi-01', 'share', 1],
  ['the-share-houses-secret-rule-hindi-02', 'share', 2],
  ['the-share-houses-secret-rule-hindi-03', 'share', 3],
  ['the-share-houses-secret-rule-hindi-04', 'share', 4],
  ['the-share-houses-secret-rule-hindi-05', 'share', 5],
  ['the-share-houses-secret-rule-hindi-06', 'share', 6],
  ['the-share-houses-secret-rule-hindi-07', 'share', 7],
  ['the-share-houses-secret-rule-hindi-08', 'share', 8],
  
  // Taisho Era Contract Marriage - episodes 1-8
  ['taisho-era-contract-marriage-hindi-01', 'taisho', 1],
  ['taisho-era-contract-marriage-hindi-02', 'taisho', 2],
  ['taisho-era-contract-marriage-hindi-03', 'taisho', 3],
  ['taisho-era-contract-marriage-hindi-04', 'taisho', 4],
  ['taisho-era-contract-marriage-hindi-05', 'taisho', 5],
  ['taisho-era-contract-marriage-hindi-06', 'taisho', 6],
  ['taisho-era-contract-marriage-hindi-07', 'taisho', 7],
  ['taisho-era-contract-marriage-hindi-08', 'taisho', 8],
  
  // Yoasobi Gurashi - episodes 1-8
  ['s1-yoasobi-gurashi-hindi-01', 'gurashi', 1],
  ['s1-yoasobi-gurashi-hindi-02', 'gurashi', 2],
  ['s1-yoasobi-gurashi-hindi-03', 'gurashi', 3],
  ['s1-yoasobi-gurashi-hindi-04', 'gurashi', 4],
  ['s1-yoasobi-gurashi-hindi-05', 'gurashi', 5],
  ['s1-yoasobi-gurashi-hindi-06', 'gurashi', 6],
  ['s1-yoasobi-gurashi-hindi-07', 'gurashi', 7],
  ['s1-yoasobi-gurashi-hindi-08', 'gurashi', 8],
  
  // Adams Sweet Agony - episodes 1-8
  ['s1-adams-sweet-agony-hindi-01', 'adams', 1],
  ['s1-adams-sweet-agony-hindi-02', 'adams', 2],
  ['s1-adams-sweet-agony-hindi-03', 'adams', 3],
  ['s1-adams-sweet-agony-hindi-04', 'adams', 4],
  ['s1-adams-sweet-agony-hindi-05', 'adams', 5],
  ['s1-adams-sweet-agony-hindi-06', 'adams', 6],
  ['s1-adams-sweet-agony-hindi-07', 'adams', 7],
  ['s1-adams-sweet-agony-hindi-08', 'adams', 8],
];

const MOVIE_MAPPINGS = [
  // Movies: [watchSlug, dbKeyword, streamUrl]
  ['demon-slayer-infinity-castle-movie-hindi-dubbed', 'demon-slayer-infinity', 'https://hsastream.com/#tuif1l'],
  ['watch-naruto-the-movie-1-ninja-clash-in-the-land-of-snow-hindi-dubbed', 'naruto', 'https://hsastream.com/#yjlrw6'],
  ['chainsaw-man-movie-reze-arc', 'chainsaw-man-the-movie-reze-arc', 'https://hsastream.com/#pntixt'],
];

// Load watch results
const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'watch_page_results.json'), 'utf8'));
const streamMap = {};
for (const r of results) {
  if (r.streamUrl) streamMap[r.slug] = r.streamUrl;
}

let updated = 0;

// Episode mappings
for (const [watchSlug, keyword, epNum] of EPISODE_MAPPINGS) {
  const streamUrl = streamMap[watchSlug];
  if (!streamUrl) { console.log(`No stream for ${watchSlug}`); continue; }
  
  // Find series in DB
  const series = db.find(a => 
    a.type === 'series' && 
    a.slug.toLowerCase().includes(keyword.toLowerCase()) &&
    a.episodes && a.episodes.length > 0
  );
  
  if (!series) {
    // Create new minimal entry or skip
    console.log(`No DB series found for keyword: ${keyword}`);
    continue;
  }
  
  // Find episode
  const ep = series.episodes.find(e => e.number === epNum);
  if (ep) {
    if (!ep.streamUrl) {
      ep.streamUrl = streamUrl;
      updated++;
      console.log(`✓ ${series.title} ep${epNum} -> ${streamUrl}`);
    }
  } else {
    // Episode doesn't exist, create it
    series.episodes.push({
      number: epNum,
      title: `Episode ${epNum}`,
      slug: `${series.slug}-episode-${epNum}`,
      url: `/watch/${series.slug}/episode-${epNum}`,
      thumbnail: series.poster || '',
      streamUrl
    });
    updated++;
    console.log(`+ ${series.title} added ep${epNum} -> ${streamUrl}`);
  }
}

// Movie mappings
for (const [watchSlug, keyword, streamUrl] of MOVIE_MAPPINGS) {
  const movie = db.find(a => 
    a.slug.toLowerCase().includes(keyword.toLowerCase()) &&
    a.type === 'movie'
  );
  
  if (movie) {
    if (!movie.streamUrl || movie.streamUrl !== streamUrl) {
      movie.streamUrl = streamUrl;
      updated++;
      console.log(`✓ MOVIE ${movie.title} -> ${streamUrl}`);
    }
  } else {
    console.log(`No DB movie found for: ${keyword}`);
    // Look at all movies with similar names
    const similar = db.filter(a => a.type === 'movie' && a.slug.includes(keyword.split('-')[0]));
    if (similar.length > 0) console.log('  Similar:', similar.map(a => a.slug));
  }
}

console.log(`\nUpdated ${updated} items`);
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('DB saved!');
