const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CACHE_FILE = path.join(__dirname, 'toonstream_episode_streams_cache.json');
const seriesMeta = JSON.parse(fs.readFileSync(path.join(__dirname, 'toonstream_series_meta.json'), 'utf8'));

// Load existing stream cache
let streamCache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    streamCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Loaded ${Object.keys(streamCache).length} existing cached episode streams.`);
  } catch (e) {}
}

function isValidStream(url) {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase().trim();
  if (!l.startsWith('http')) return false;
  if (
    l.includes('themoviedb.org') ||
    l.includes('youtube.com') ||
    l.includes('google') ||
    l.includes('facebook') ||
    l.includes('about:blank') ||
    l.includes('short.icu') ||
    l.includes('short.link')
  ) {
    return false;
  }
  return true;
}

function extractStreamsFromHtml(html) {
  const $ = cheerio.load(html);
  const streams = [];
  $('iframe').each((_, el) => {
    let s = $(el).attr('src') || $(el).attr('data-src') || '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (isValidStream(s) && !streams.includes(s)) streams.push(s);
  });
  return streams;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://toonstream.us/'
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

async function scrapeEpisodeStream(epUrl) {
  if (streamCache[epUrl]) return streamCache[epUrl];
  const html = await fetchHtml(epUrl);
  if (!html) return null;
  const streams = extractStreamsFromHtml(html);
  if (streams.length === 0) return null;

  const activeStreams = streams.filter(s => !s.includes('as-cdn'));
  const saltStreams = streams.filter(s => s.includes('as-cdn'));
  const primaryStream = activeStreams[0] || saltStreams[0] || '';

  const sources = [];
  activeStreams.forEach((s, idx) => {
    sources.push({
      label: idx === 0 ? 'ToonStream 1 (HD)' : `ToonStream ${idx + 1} (Mirror)`,
      url: s,
      isMultiAudio: true
    });
  });
  saltStreams.forEach(s => {
    sources.push({
      label: 'AnimeSalt (Backup)',
      url: s,
      isMultiAudio: true
    });
  });

  const res = {
    streamUrl: primaryStream,
    toonStreamUrl: activeStreams[0] || '',
    saltStreamUrl: saltStreams[0] || '',
    streamSources: sources
  };

  streamCache[epUrl] = res;
  return res;
}

async function main() {
  // Collect all episodes that are NOT yet in streamCache
  const allEpisodes = [];
  for (const s of seriesMeta) {
    for (const ep of s.episodes) {
      if (!streamCache[ep.url]) {
        allEpisodes.push(ep);
      }
    }
  }

  console.log(`Total episodes across all 471 series: 9030`);
  console.log(`Already cached in memory: ${Object.keys(streamCache).length}`);
  console.log(`Unscraped episodes remaining to fetch: ${allEpisodes.length}`);

  if (allEpisodes.length === 0) {
    console.log('All episodes are already scraped and cached!');
    return;
  }

  const concurrency = 25;
  let count = 0;
  let success = 0;

  for (let i = 0; i < allEpisodes.length; i += concurrency) {
    const batch = allEpisodes.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (ep) => {
        const res = await scrapeEpisodeStream(ep.url);
        count++;
        if (res && res.streamUrl) success++;
      })
    );

    if (count % 100 === 0 || count >= allEpisodes.length) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(streamCache, null, 2));
      process.stdout.write(`\rProgress: ${count}/${allEpisodes.length} fetched (${Object.keys(streamCache).length} total cached)`);
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(streamCache, null, 2));
  console.log(`\n\nScraping complete! Total episodes cached with stream links: ${Object.keys(streamCache).length}`);
}

main().catch(console.error);
