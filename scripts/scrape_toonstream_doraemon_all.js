const fs = require('fs');
const cheerio = require('cheerio');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://toonstream.us/home',
};

const moviesList = [
  { slug: 'doraemon-the-movie-nobitas-little-star-wars-2021', title: "Doraemon the Movie: Nobita's Little Star Wars 2021", url: 'https://toonstream.us/movies/doraemon-the-movie-nobitas-little-star-wars-2021' },
  { slug: 'doraemon-nobita-and-the-green-giant-legend', title: 'Doraemon: Nobita and the Green Giant Legend', url: 'https://toonstream.us/movies/doraemon-nobita-and-the-green-giant-legend' },
  { slug: 'doraemon-nobita-and-the-new-steel-troops-winged-angels', title: 'Doraemon: Nobita and the New Steel Troops: Winged Angels', url: 'https://toonstream.us/movies/doraemon-nobita-and-the-new-steel-troops-winged-angels' },
  { slug: 'doraemon-nobita-and-the-space-heroes', title: 'Doraemon: Nobita and the Space Heroes', url: 'https://toonstream.us/movies/doraemon-nobita-and-the-space-heroes' },
  { slug: 'doraemon-nobita-and-the-tin-labyrinth', title: 'Doraemon: Nobita and the Tin Labyrinth', url: 'https://toonstream.us/movies/doraemon-nobita-and-the-tin-labyrinth' },
  { slug: 'doraemon-nobita-in-the-wan-nyan-spacetime-odyssey', title: 'Doraemon: Nobita in the Wan-Nyan Spacetime Odyssey', url: 'https://toonstream.us/movies/doraemon-nobita-in-the-wan-nyan-spacetime-odyssey' },
  { slug: 'doraemon-nobitas-chronicle-of-the-moon-exploration', title: "Doraemon: Nobita's Chronicle of the Moon Exploration", url: 'https://toonstream.us/movies/doraemon-nobitas-chronicle-of-the-moon-exploration' },
  { slug: 'doraemon-nobitas-diary-on-the-creation-of-the-world', title: "Doraemon: Nobita's Diary on the Creation of the World", url: 'https://toonstream.us/movies/doraemon-nobitas-diary-on-the-creation-of-the-world' },
  { slug: 'doraemon-nobitas-dorabian-nights', title: "Doraemon: Nobita's Dorabian Nights", url: 'https://toonstream.us/movies/doraemon-nobitas-dorabian-nights' },
  { slug: 'doraemon-nobitas-great-adventure-in-the-antarctic-kachi-kochi', title: "Doraemon: Nobita's Great Adventure in the Antarctic Kachi Kochi", url: 'https://toonstream.us/movies/doraemon-nobitas-great-adventure-in-the-antarctic-kachi-kochi' },
  { slug: 'doraemon-nobitas-great-adventure-in-the-south-seas', title: "Doraemon: Nobita's Great Adventure in the South Seas", url: 'https://toonstream.us/movies/doraemon-nobitas-great-adventure-in-the-south-seas' },
  { slug: 'doraemon-nobitas-little-star-wars', title: "Doraemon: Nobita's Little Star Wars", url: 'https://toonstream.us/movies/doraemon-nobitas-little-star-wars' },
  { slug: 'doraemon-nobitas-new-dinosaur', title: "Doraemon: Nobita's New Dinosaur", url: 'https://toonstream.us/movies/doraemon-nobitas-new-dinosaur' },
  { slug: 'doraemon-nobitas-secret-gadget-museum', title: "Doraemon: Nobita's Secret Gadget Museum", url: 'https://toonstream.us/movies/doraemon-nobitas-secret-gadget-museum' },
  { slug: 'doraemon-nobitas-three-visionary-swordsmen', title: "Doraemon: Nobita's Three Visionary Swordsmen", url: 'https://toonstream.us/movies/doraemon-nobitas-three-visionary-swordsmen' },
  { slug: 'doraemon-nobitas-treasure-island', title: "Doraemon: Nobita's Treasure Island", url: 'https://toonstream.us/movies/doraemon-nobitas-treasure-island' },
  { slug: 'doraemon-the-movie-nobitas-earth-symphony', title: "Doraemon the Movie: Nobita's Earth Symphony", url: 'https://toonstream.us/movies/doraemon-the-movie-nobitas-earth-symphony' },
  { slug: 'doraemon-the-movie-nobitas-sky-utopia', title: "Doraemon the Movie: Nobita's Sky Utopia", url: 'https://toonstream.us/movies/doraemon-the-movie-nobitas-sky-utopia' },
  { slug: 'doraemon-the-record-of-nobitas-parallel-journey-to-the-west', title: "Doraemon: The Record of Nobita's Parallel Journey to the West", url: 'https://toonstream.us/movies/doraemon-the-record-of-nobitas-parallel-journey-to-the-west' },
  { slug: 'stand-by-me-doraemon', title: 'Stand by Me Doraemon', url: 'https://toonstream.us/movies/stand-by-me-doraemon' },
  { slug: 'stand-by-me-doraemon-2', title: 'Stand by Me Doraemon 2', url: 'https://toonstream.us/movies/stand-by-me-doraemon-2' },
];

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
    l.includes('short.link') ||
    l.includes('toonstream.us')
  ) {
    return false;
  }
  return true;
}

async function scrapeAll21() {
  console.log(`Starting scrape of ${moviesList.length} Doraemon movies from ToonStream...`);
  const detailed = [];

  for (const m of moviesList) {
    try {
      console.log(`Fetching: ${m.title} (${m.url})`);
      const res = await fetch(m.url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.error(`Failed ${m.url}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const $ = cheerio.load(html);

      // Poster
      const poster = $('.poster img, .entry-content img, .post-thumbnail img').first().attr('src') || 
                     $('meta[property="og:image"]').attr('content') || '';

      // Synopsis / Overview
      const desc = $('.entry-content p, .description p, .synopsis, .film-description').first().text().trim() ||
                   $('meta[property="og:description"]').attr('content') || '';

      // Year / Release
      const yearText = $('.extra span, .year, .release-year').text();
      const yearMatch = yearText.match(/\b(19\d\d|20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : '';

      // Audio languages
      const audio = [];
      if (html.toLowerCase().includes('hindi')) audio.push('Hindi');
      if (html.toLowerCase().includes('urdu')) audio.push('Urdu');
      if (html.toLowerCase().includes('tamil')) audio.push('Tamil');
      if (html.toLowerCase().includes('telugu')) audio.push('Telugu');
      if (html.toLowerCase().includes('japanese')) audio.push('Japanese');
      if (html.toLowerCase().includes('english')) audio.push('English');
      if (audio.length === 0) audio.push('Hindi', 'Urdu', 'Japanese');

      // Extract all iframes and player sources
      const rawStreams = [];

      // 1. All iframes (src and data-src)
      $('iframe').each((_, el) => {
        let s = $(el).attr('src') || $(el).attr('data-src') || '';
        if (s.startsWith('//')) s = 'https:' + s;
        if (isValidStream(s) && !rawStreams.includes(s)) rawStreams.push(s);
      });

      // 2. data-player, data-embed, playex, etc.
      $('[data-player], [data-embed], .playex, [data-url]').each((_, el) => {
        let s = $(el).attr('data-player') || $(el).attr('data-embed') || $(el).attr('data-url') || $(el).attr('data-src') || '';
        if (s.startsWith('//')) s = 'https:' + s;
        if (isValidStream(s) && !rawStreams.includes(s)) rawStreams.push(s);
      });

      // 3. Script tags containing links or embeds
      $('script').each((_, el) => {
        const t = $(el).text();
        const matches = t.match(/https?:\/\/[^"'<>\s]+\.(html|mp4|m3u8|top|xyz|one|site|to|net|link|buzz|com)[^"'<>\s]*/g) || [];
        for (const s of matches) {
          if (isValidStream(s) && !rawStreams.includes(s)) {
            // Only add known player domains
            if (s.includes('filesforever') || s.includes('cloudy') || s.includes('vidmoly') || s.includes('abyssplayer') || s.includes('strmup') || s.includes('emturbovid') || s.includes('rubystm') || s.includes('as-cdn') || s.includes('streamhide')) {
              rawStreams.push(s);
            }
          }
        }
      });

      console.log(`  -> Found ${rawStreams.length} stream links:`, rawStreams);

      detailed.push({
        slug: m.slug,
        title: m.title,
        url: m.url,
        toonUrl: m.url,
        poster,
        description: desc,
        year,
        audioLanguages: audio,
        streams: rawStreams
      });
    } catch (e) {
      console.error(`Error processing ${m.slug}: ${e.message}`);
    }
  }

  fs.writeFileSync('scripts/doraemon_scraped_streams.json', JSON.stringify(detailed, null, 2));
  console.log(`\nSuccessfully scraped all ${detailed.length} Doraemon movies!`);
}

scrapeAll21();
