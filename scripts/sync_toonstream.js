/**
 * Automated ToonStream Scraper & Database Synchronizer for AnimePakistan
 * Usage: npm run scrape:toonstream
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('=== [1/4] Crawling ToonStream Catalog (Anime, Cartoons, Movies) ===');
execSync('node scripts/crawl_toonstream_full.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log('\n=== [2/4] Scraping All Movie Streams ===');
execSync('node scripts/scrape_all_toonstream_movies.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log('\n=== [3/4] Scraping All Series Metadata & Episodes ===');
execSync('node scripts/scrape_all_toonstream_series.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log('\n=== [4/4] Integrating Streams into Database & Syncing Catalog ===');
execSync('node scripts/integrate_toonstream_into_db.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

console.log('\n✅ All Anime & Cartoons from ToonStream successfully synced with streams!');
