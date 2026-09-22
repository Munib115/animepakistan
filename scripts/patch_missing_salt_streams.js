/**
 * scripts/patch_missing_salt_streams.js
 *
 * Scrapes direct stream links for all episodes in anime-db.json
 * that are missing a working streamUrl.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const CATALOG_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-catalog.json');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isValidStreamEmbed(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
  if (lower.includes('short.icu') || lower.includes('short.link') || lower.includes('linkvertise')) return false;
  if (lower.includes('animesalt.cx/episode') || lower.includes('animesalt.cx/series') || lower.includes('animesalt.cx/movies')) return false;
  if (lower.includes('google') || lower.includes('doubleclick') || lower.includes('disqus') || lower.includes('facebook')) return false;
  return true;
}

async function fetchWithUA(url, retries = 3, timeoutMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://animesalt.cx/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: controller.signal
      });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.text();
    } catch (err) {
      clearTimeout(id);
      if (attempt === retries) throw err;
      await delay(1000 * attempt);
    }
  }
}

function extractStreamFromHtml(html) {
  const $ = cheerio.load(html);
  const candidates = [];

  // Check all iframes
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (src) {
      const full = src.startsWith('//') ? 'https:' + src : src;
      if (full.includes('multi-lang-plyr/player.php?data=')) {
        try {
          const u = new URL(full);
          const dataParam = u.searchParams.get('data');
          if (dataParam) {
            const decoded = JSON.parse(Buffer.from(dataParam, 'base64').toString('utf8'));
            if (Array.isArray(decoded)) {
              for (const item of decoded) {
                if (item.link && isValidStreamEmbed(item.link)) {
                  candidates.push(item.link);
                }
              }
            }
          }
        } catch (e) {}
      } else if (isValidStreamEmbed(full)) {
        candidates.push(full);
      }
    }
  });

  // Check data attributes
  $('[data-player], [data-embed], .playex').each((_, el) => {
    const embed = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-src') || '';
    if (embed && isValidStreamEmbed(embed)) {
      candidates.push(embed.startsWith('//') ? 'https:' + embed : embed);
    }
  });

  if (candidates.length === 0) return null;

  // Prioritize as-cdn, then megaplay, then others
  const asCdn = candidates.find(c => c.includes('as-cdn'));
  if (asCdn) return asCdn.replace(/as-cdn2[0-5]\.top/gi, 'as-cdn26.top');

  const megaplay = candidates.find(c => c.includes('megaplay.buzz'));
  if (megaplay) return megaplay;

  return candidates[0];
}

async function main() {
  console.log('=== FIXING & PATCHING ANIMESALT EPISODE STREAM LINKS ===\n');

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  const tasks = [];
  for (const item of db) {
    if (!item.episodes || item.episodes.length === 0) continue;
    for (const ep of item.episodes) {
      if (!ep.streamUrl || !isValidStreamEmbed(ep.streamUrl)) {
        let epUrl = ep.url;
        if (!epUrl || !epUrl.startsWith('http')) {
          const slug = ep.slug;
          epUrl = `https://animesalt.cx/episode/${slug}/`;
        }
        tasks.push({ seriesTitle: item.title, ep, epUrl });
      }
    }
  }

  console.log(`Found ${tasks.length} episodes missing valid stream links across database.\n`);

  let resolvedCount = 0;
  let failedCount = 0;
  const CONCURRENCY = 5;

  async function worker(index) {
    while (tasks.length > 0) {
      const task = tasks.shift();
      if (!task) break;

      try {
        const html = await fetchWithUA(task.epUrl);
        const streamUrl = extractStreamFromHtml(html);
        if (streamUrl) {
          task.ep.streamUrl = streamUrl;
          resolvedCount++;
          console.log(`[✓ ${resolvedCount}] ${task.seriesTitle} - ${task.ep.title} -> ${streamUrl}`);
        } else {
          failedCount++;
          console.warn(`[✗ FAIL] No stream found on page: ${task.seriesTitle} - ${task.ep.title} (${task.epUrl})`);
        }
      } catch (err) {
        failedCount++;
        console.warn(`[✗ ERR] ${task.seriesTitle} - ${task.ep.title}: ${err.message}`);
      }

      await delay(100);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  console.log('\n===========================================');
  console.log(`RESOLVED: ${resolvedCount} stream links`);
  console.log(`FAILED:   ${failedCount}`);
  console.log('===========================================\n');

  // Save updated anime-db.json
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`💾 Saved updated ${DB_PATH}`);

  // Also update anime-catalog.json if it exists
  if (fs.existsSync(CATALOG_PATH)) {
    console.log('🔄 Syncing catalog...');
    const catalog = db.map(item => ({
      id: item.id || item.slug,
      title: item.title,
      slug: item.slug,
      saltSlug: item.saltSlug || item.slug,
      type: item.type || 'series',
      poster: item.poster || '',
      backdrop: item.backdrop || '',
      rating: item.rating || 8.0,
      year: item.year || 2024,
      genres: item.genres || [],
      audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
      episodesCount: item.episodes ? item.episodes.length : 0,
      hasStreams: item.episodes ? item.episodes.some(e => e.streamUrl) : !!item.streamUrl
    }));
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
    console.log('💾 anime-catalog.json synced!');
  }
}

main().catch(console.error);
