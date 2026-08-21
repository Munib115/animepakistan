const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const targetUrl = url.replace(/^http:\/\//i, 'https://');
    const client = targetUrl.startsWith('https') ? https : http;

    client.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function fetchAnilist(query) {
  return new Promise((resolve) => {
    const graphqlQuery = JSON.stringify({
      query: `
        query ($search: String) {
          Media(search: $search, type: ANIME) {
            id
            title {
              romaji
              english
              native
            }
            description
            coverImage {
              extraLarge
              large
            }
            bannerImage
            averageScore
            seasonYear
            status
            genres
          }
        }
      `,
      variables: { search: query }
    });

    const req = https.request('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data?.Media || null);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.write(graphqlQuery);
    req.end();
  });
}

function parsePoster(html) {
  const $ = cheerio.load(html);
  
  const posterCandidates = [
    $('.poster img').attr('data-src') || $('.poster img').attr('src'),
    $('.entry-header img').attr('data-src') || $('.entry-header img').attr('src'),
    $('.post-thumbnail img').attr('data-src') || $('.post-thumbnail img').attr('src'),
    $('.thumb img').attr('data-src') || $('.thumb img').attr('src'),
    $('img.TPostBg').attr('data-src') || $('img.TPostBg').attr('src'),
    $('meta[property="og:image"]').attr('content'),
    $('meta[name="twitter:image"]').attr('content'),
  ];

  for (const p of posterCandidates) {
    if (p && !p.startsWith('data:image') && !p.includes('AnimeSaltLong.png')) {
      return p.startsWith('//') ? 'https:' + p : p;
    }
  }

  let found = '';
  $('img').each((i, el) => {
    const dSrc = $(el).attr('data-src') || $(el).attr('src') || '';
    if (dSrc && !dSrc.startsWith('data:image') && !dSrc.includes('AnimeSaltLong.png') && (dSrc.includes('tmdb.org') || dSrc.includes('image') || dSrc.includes('thumb'))) {
      found = dSrc.startsWith('//') ? 'https:' + dSrc : dSrc;
      return false;
    }
  });

  return found;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const items = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  console.log(`Total items in DB: ${items.length}`);

  let missingPoster = 0;
  for (const item of items) {
    const p = item.poster || item.anilist?.coverImage;
    if (!p || p.includes('AnimeSaltLong.png') || p.startsWith('data:image')) {
      missingPoster++;
    }
  }
  console.log(`Items with missing/invalid poster: ${missingPoster}`);

  let updated = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let currentPoster = item.poster;

    if (!currentPoster || currentPoster.includes('AnimeSaltLong.png') || currentPoster.startsWith('data:image')) {
      console.log(`[${i + 1}/${items.length}] Fixing poster for: ${item.title}`);
      
      // 1. Try scraping page
      try {
        const html = await fetchPage(item.url);
        const scrapedPoster = parsePoster(html);
        if (scrapedPoster) {
          item.poster = scrapedPoster;
          currentPoster = scrapedPoster;
          console.log(`  -> Found from page: ${scrapedPoster}`);
        }
      } catch (e) {
        console.log(`  -> Page fetch error: ${e.message}`);
      }

      // 2. If still missing, try Anilist high-quality cover
      if (!currentPoster || currentPoster.includes('AnimeSaltLong.png') || currentPoster.startsWith('data:image')) {
        let cleanTitle = item.title
          .replace(/\(.*\)/g, '')
          .replace(/\[.*\]/g, '')
          .replace(/season \d+/gi, '')
          .replace(/dubbed|dub|sub|multi|hindi|tamil|telugu/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

        const anilistData = await fetchAnilist(cleanTitle);
        if (anilistData && anilistData.coverImage) {
          const anilistPoster = anilistData.coverImage.extraLarge || anilistData.coverImage.large;
          item.poster = anilistPoster;
          item.anilist = {
            id: anilistData.id,
            romajiName: anilistData.title?.romaji || '',
            englishName: anilistData.title?.english || '',
            nativeName: anilistData.title?.native || '',
            description: anilistData.description || '',
            coverImage: anilistPoster,
            bannerImage: anilistData.bannerImage || '',
            rating: anilistData.averageScore || null,
            year: anilistData.seasonYear || null,
            season: anilistData.season || '',
            status: anilistData.status || '',
            genres: anilistData.genres || []
          };
          console.log(`  -> Found from Anilist: ${anilistPoster}`);
        }
      }

      updated++;
      if (updated % 5 === 0) {
        fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
      }

      await delay(120);
    }
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf8');
  console.log(`=== AUDIT COMPLETE: Updated ${updated} posters ===`);
}

main();
