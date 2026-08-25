/**
 * populate_salt_slugs.js
 * 
 * Discovers the correct animesalt.me /tv/{slug}/ for each anime in the database
 * by trying the local slug first, then searching animesalt.me if it 404s.
 * 
 * Usage: node scripts/populate_salt_slugs.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const DELAY_MS = 600; // polite delay between requests

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.me/',
        'Accept': 'text/html',
      }
    }, (res) => {
      let data = '';
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        return resolve(fetchUrl(res.headers.location));
      }
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, html: data, finalUrl: url }));
    });
    req.on('error', () => resolve({ status: 0, html: '', finalUrl: url }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, html: '', finalUrl: url }); });
  });
}

/**
 * Check if a slug exists on animesalt.me /tv/{slug}/ and has triggerEpisode data
 */
async function checkSaltSlug(slug) {
  const url = `https://animesalt.me/tv/${slug}/`;
  const { status, html } = await fetchUrl(url);
  if (status === 200 && html.includes('triggerEpisode')) {
    return true;
  }
  return false;
}

/**
 * Try common slug transformations to find the right animesalt.me slug
 */
function generateCandidateSlugs(anime) {
  const base = anime.slug;
  const title = anime.title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const candidates = new Set([
    base,
    title,
    // Remove season suffixes
    base.replace(/-season-\d+$/, '').replace(/-s\d+$/, ''),
    base.replace(/-(?:urdu|hindi|dubbed|dub|sub|english|tamil|telugu).*$/, ''),
    // Anilist slug if available
  ]);

  // Add anilist-derived slug if available
  if (anime.anilist?.romajiName) {
    const romajiSlug = anime.anilist.romajiName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    candidates.add(romajiSlug);
  }
  if (anime.anilist?.englishName) {
    const englishSlug = anime.anilist.englishName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    candidates.add(englishSlug);
  }

  return [...candidates].filter(Boolean);
}

async function main() {
  console.log('Loading anime database...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`Total anime: ${db.length}`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < db.length; i++) {
    const anime = db[i];

    // Skip if saltSlug already set and confirmed
    if (anime.saltSlug) {
      skipped++;
      continue;
    }

    // Only process series (movies are usually on /tv/ too or use /movies/)
    const candidates = generateCandidateSlugs(anime);
    let found = false;

    for (const candidate of candidates) {
      await delay(DELAY_MS);
      const exists = await checkSaltSlug(candidate);
      if (exists) {
        db[i].saltSlug = candidate;
        found = true;
        updated++;
        console.log(`[${i+1}/${db.length}] ✓ "${anime.title}" → saltSlug: "${candidate}"`);
        break;
      }
    }

    if (!found) {
      failed++;
      console.log(`[${i+1}/${db.length}] ✗ "${anime.title}" — not found on animesalt.me (tried: ${candidates.join(', ')})`);
    }

    // Save progress every 20 items
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      console.log(`\n💾 Progress saved (${updated} updated, ${failed} failed, ${skipped} skipped)\n`);
    }
  }

  // Final save
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`\n✅ Done! Updated: ${updated}, Failed: ${failed}, Skipped: ${skipped}`);
}

main().catch(console.error);
