/**
 * clean_and_prioritize_all_streams.js
 * Purges dead mirrors (rubystm 522, playonline SAMEORIGIN, as-cdn.top, short.icu)
 * and orders working mirrors with AbyssPlayer, P2PPlay, Cloudy, and FilesForever at the top.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');

function isDeadUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const l = url.toLowerCase().trim();
  if (l.includes('playonline.php') || l.includes('hindianimeszone.com')) return true;
  if (l.includes('rubystm.com') || l.includes('streamruby.com')) return true;
  if (l.includes('as-cdn') && l.includes('.top')) return true;
  if (l.includes('short.icu') || l.includes('short.link')) return true;
  if (l.includes('streamhide.')) return true;
  if (l.startsWith('about:blank') || l.includes('google') || l.includes('disqus') || l.includes('facebook')) return true;
  return false;
}

function getPriority(url) {
  const l = url.toLowerCase();
  // Rank 1: AbyssPlayer (Fastest, zero ads, multi-audio)
  if (l.includes('abyssplayer.com')) return 1;
  // Rank 2: P2PPlay / strp2p (Clean SPA player, Hindi HD)
  if (l.includes('p2pplay.online') || l.includes('strp2p.live')) return 2;
  // Rank 3: Cloudy (Reliable HD)
  if (l.includes('cloudy.upns.one')) return 3;
  // Rank 4: FilesForever (Multi-mirror)
  if (l.includes('filesforever.link') || l.includes('iqsmartgames.com')) return 4;
  // Rank 5: Vidmoly
  if (l.includes('vidmoly.net')) return 5;
  // Rank 6: VidStreaming / StrmUp / Turbo
  if (l.includes('vidstreaming.xyz') || l.includes('strmup.to') || l.includes('turbonewvid.com')) return 6;
  return 10;
}

function cleanAndSortSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return [];

  // Filter out duplicates and dead URLs
  const seenUrls = new Set();
  const valid = [];

  for (const s of sources) {
    if (!s || !s.url) continue;
    const cleanUrl = s.url.trim();
    if (isDeadUrl(cleanUrl)) continue;
    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    // Format cleaner label
    let label = s.label || 'Server HD';
    if (cleanUrl.includes('abyssplayer.com')) label = 'Abyss (Multi Audio)';
    else if (cleanUrl.includes('p2pplay.online') || cleanUrl.includes('strp2p.live')) label = 'HAZ Player (Hindi HD)';
    else if (cleanUrl.includes('cloudy.upns.one')) label = 'Cloudy (HD)';
    else if (cleanUrl.includes('filesforever.link')) label = 'FilesForever (Mirror)';
    else if (cleanUrl.includes('vidmoly.net')) label = 'Vidmoly (Mirror)';
    else if (cleanUrl.includes('vidstreaming.xyz')) label = 'VidStreaming (Mirror)';

    valid.push({
      label,
      url: cleanUrl,
      isMultiAudio: s.isMultiAudio ?? true
    });
  }

  // Sort by priority rank
  valid.sort((a, b) => getPriority(a.url) - getPriority(b.url));

  return valid;
}

function run() {
  console.log('Loading database...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  let cleanedMovies = 0;
  let cleanedEpisodes = 0;

  db.forEach(item => {
    if (item.type === 'movie') {
      const before = item.streamSources?.length || 0;
      item.streamSources = cleanAndSortSources(item.streamSources);
      if (item.streamSources.length > 0) {
        item.streamUrl = item.streamSources[0].url;
        cleanedMovies++;
      } else {
        item.streamUrl = undefined;
      }
    } else if (item.episodes) {
      item.episodes.forEach(ep => {
        ep.streamSources = cleanAndSortSources(ep.streamSources);
        if (ep.streamSources.length > 0) {
          ep.streamUrl = ep.streamSources[0].url;
          cleanedEpisodes++;
        } else {
          ep.streamUrl = undefined;
        }
      });
    }
  });

  console.log(`Cleaned and prioritized streams for:`);
  console.log(`- ${cleanedMovies} movies with working active streams`);
  console.log(`- ${cleanedEpisodes} episodes with working active streams`);

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Saved clean anime-db.json`);

  // Regenerate anime-catalog.json
  const catalog = db.map(item => ({
    id: item.id || `ap-${item.slug}`,
    title: item.title,
    slug: item.slug,
    saltSlug: item.saltSlug || undefined,
    toonSlug: item.toonSlug || undefined,
    type: item.type || 'series',
    poster: item.poster || '',
    backdrop: item.backdrop || item.poster || '',
    genres: item.genres || ['Anime'],
    audioLanguages: item.audioLanguages || ['Hindi', 'Urdu'],
    rating: item.rating || 8.0,
    year: item.year || 2024,
    episodeCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    episodesCount: item.type === 'movie' ? 1 : (item.episodes ? item.episodes.length : 1),
    hasStreams: item.type === 'movie'
      ? !!(item.streamUrl || (item.streamSources && item.streamSources.length > 0))
      : (item.episodes?.some(e => !!(e.streamUrl || (e.streamSources && e.streamSources.length > 0))) ?? false),
    source: item.source || 'hybrid'
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved updated anime-catalog.json (${catalog.length} items).`);
}

run();
