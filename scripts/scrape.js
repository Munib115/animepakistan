const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CACHE_FILE = path.join(__dirname, 'scrape_cache.json');
const FINAL_FILE = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');

// Ensure directories exist
const dataDir = path.join(__dirname, '..', 'src', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Utility delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch with user-agent
async function fetchWithUA(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.text();
}

// Extract links from a sitemap XML
function parseSitemapUrls(xmlText) {
  const $ = cheerio.load(xmlText, { xmlMode: true });
  const urls = [];
  $('loc').each((i, el) => {
    const loc = $(el).text().trim();
    if (loc) urls.push(loc);
  });
  return urls;
}

// Parse details from a movie/series page
function parseItemPage(htmlText, url, type) {
  const $ = cheerio.load(htmlText);
  
  const title = $('h1').first().text().trim() || $('title').text().trim().split('-')[0].trim();
  
  // Extract slug from URL
  const slug = url.split('/').filter(Boolean).pop();
  
  // Extract local poster from image source
  let poster = '';
  // Look for main article image or poster card
  const imgEl = $('.post-thumbnail img, .poster img, figure img').first();
  if (imgEl.length > 0) {
    poster = imgEl.attr('data-src') || imgEl.attr('src') || '';
    if (poster.startsWith('//')) {
      poster = 'https:' + poster;
    }
  }

  // Extract description
  const description = $('.entry-content p, #description p, .synopsis p').first().text().trim() || 
                      $('.entry-content, #description, .synopsis').first().text().trim() || '';

  // Extract metadata (genres, status, release year, etc.)
  const genres = [];
  $('a[href*="/category/genre/"], a[href*="/genre/"]').each((i, el) => {
    const text = $(el).text().trim();
    if (text && !genres.includes(text)) genres.push(text);
  });

  const audioLanguages = [];
  $('a[href*="/category/language/"], a[href*="/language/"]').each((i, el) => {
    const text = $(el).text().trim();
    if (text && !audioLanguages.includes(text)) audioLanguages.push(text);
  });

  const details = {
    title,
    slug,
    url,
    type,
    poster,
    description: description.substring(0, 500),
    genres,
    audioLanguages
  };

  // If it's a series, parse episodes list
  if (type === 'series') {
    const episodes = [];
    $('article.episodes').each((i, el) => {
      const epLinkEl = $(el).find('a.lnk-blk').first();
      const epHref = epLinkEl.attr('href') || '';
      
      const epNum = $(el).find('.num-epi').text().trim();
      let epTitle = $(el).find('.entry-title').text().trim() || `Episode ${epNum}`;
      
      // Clean up title (remove "Private: ")
      epTitle = epTitle.replace(/^private:\s*/gi, '');

      // Extract episode slug from link
      const epSlug = epHref.split('/').filter(Boolean).pop() || '';
      
      let epThumb = $(el).find('figure img').attr('data-src') || $(el).find('figure img').attr('src') || '';
      if (epThumb.startsWith('//')) {
        epThumb = 'https:' + epThumb;
      }

      if (epSlug) {
        episodes.push({
          number: parseInt(epNum, 10) || i + 1,
          title: epTitle,
          slug: epSlug,
          url: epHref,
          thumbnail: epThumb
        });
      }
    });
    
    // Sort episodes by number ascending
    episodes.sort((a, b) => a.number - b.number);
    details.episodes = episodes;
  }

  return details;
}

// Fetch Anilist metadata
async function fetchAnilistMetadata(title) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
        }
        bannerImage
        description
        averageScore
        seasonYear
        season
        status
        genres
      }
    }
  `;

  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { search: title }
      })
    });
    
    if (res.status === 429) {
      console.log('    Anilist Rate Limited (429), waiting 5 seconds...');
      await delay(5000);
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    return json.data?.Media || null;
  } catch (err) {
    console.error(`    Anilist Fetch Error:`, err.message);
    return null;
  }
}

async function run() {
  console.log('=== STARTING ANIME SCRAPER ===');
  
  // Load cache if exists
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      console.log(`Loaded cache: ${Object.keys(cache).length} entries`);
    } catch (e) {
      console.log('Failed to parse cache, starting fresh');
    }
  }

  // 1. Get all sitemap URLs
  const sitemaps = [
    { url: 'https://animesalt.link/movies-sitemap.xml', type: 'movie' },
    { url: 'https://animesalt.link/series-sitemap1.xml', type: 'series' },
    { url: 'https://animesalt.link/series-sitemap2.xml', type: 'series' }
  ];

  const allUrls = [];
  for (const sm of sitemaps) {
    try {
      console.log(`Fetching sitemap: ${sm.url}`);
      const xml = await fetchWithUA(sm.url);
      const urls = parseSitemapUrls(xml);
      
      // Filter out main folders
      const filtered = urls.filter(u => {
        const parts = u.split('/').filter(Boolean);
        // Valid movie item URL will be like https://animesalt.link/movies/slug/ (3 path parts after domain)
        return parts.length >= 2 && parts[1] !== 'movies' && parts[1] !== 'series';
      });
      
      console.log(`  Found ${filtered.length} items`);
      filtered.forEach(u => allUrls.push({ url: u, type: sm.type }));
    } catch (err) {
      console.error(`Failed to fetch sitemap ${sm.url}:`, err.message);
    }
  }

  console.log(`Total URLs to scrape: ${allUrls.length}`);

  // Helper to save current database state
  const saveFinalDB = (dataList) => {
    try {
      fs.writeFileSync(FINAL_FILE, JSON.stringify(dataList, null, 2), 'utf8');
      console.log(`    [Progress] Saved database with ${dataList.length} items`);
    } catch (e) {
      console.error('    [Progress] Failed to save database:', e.message);
    }
  };

  // 2. Scrape individual pages
  let count = 0;
  for (const item of allUrls) {
    count++;
    if (cache[item.url]) {
      // Entry already scraped
      continue;
    }

    console.log(`[${count}/${allUrls.length}] Scraping ${item.url}...`);
    try {
      const html = await fetchWithUA(item.url);
      const details = parseItemPage(html, item.url, item.type);
      cache[item.url] = details;
      
      // Write cache file and final database periodically
      if (count % 5 === 0) {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
        saveFinalDB(Object.values(cache));
      }
      
      // Polite delay between scrapes
      await delay(250);
    } catch (err) {
      console.error(`  Error scraping ${item.url}:`, err.message);
      // Wait longer on error
      await delay(1000);
    }
  }

  // Save final cache and database state of the scrape phase
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  saveFinalDB(Object.values(cache));
  console.log(`Scraping complete! Total scraped items: ${Object.keys(cache).length}`);

  // 3. Match metadata with Anilist
  console.log('\n=== MATCHING METADATA WITH ANILIST ===');
  const items = Object.values(cache);
  const enrichedItems = [];
  
  let matchCount = 0;
  for (const item of items) {
    matchCount++;
    console.log(`[${matchCount}/${items.length}] Enriching: ${item.title}`);
    
    // Check if already enriched in cache
    if (item.anilist) {
      enrichedItems.push(item);
      continue;
    }

    // Clean up title for searching (remove release year, language tag brackets, etc.)
    let searchTitle = item.title
      .replace(/\(.*\)/g, '') // remove parentheses content
      .replace(/\[.*\]/g, '') // remove brackets content
      .replace(/season \d+/gi, '') // remove season
      .replace(/dubbed|dub|sub|multi|hindi|tamil|telugu/gi, '') // remove quality tags
      .replace(/\s+/g, ' ') // normalize spaces
      .trim();

    if (!searchTitle) searchTitle = item.title;

    console.log(`  Searching Anilist for: "${searchTitle}"`);
    const anilistData = await fetchAnilistMetadata(searchTitle);
    
    if (anilistData) {
      console.log(`  -> Match Found! Romaji: ${anilistData.title?.romaji || 'N/A'}, English: ${anilistData.title?.english || 'N/A'}`);
      item.anilist = {
        id: anilistData.id,
        romajiName: anilistData.title?.romaji || '',
        englishName: anilistData.title?.english || '',
        nativeName: anilistData.title?.native || '',
        description: anilistData.description || '',
        coverImage: anilistData.coverImage?.extraLarge || anilistData.coverImage?.large || '',
        bannerImage: anilistData.bannerImage || '',
        rating: anilistData.averageScore || null,
        year: anilistData.seasonYear || null,
        season: anilistData.season || '',
        status: anilistData.status || '',
        genres: anilistData.genres || []
      };
    } else {
      console.log(`  -> No match found, using scraped metadata`);
      item.anilist = null;
    }

    enrichedItems.push(item);
    
    // Save partial progress to cache and database file
    cache[item.url] = item;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    
    if (matchCount % 5 === 0) {
      saveFinalDB([
        ...enrichedItems,
        ...items.slice(matchCount) // merge with remaining unenriched items so they still appear on site
      ]);
    }

    // Polite delay for Anilist API limit (90/min -> ~1 req every 700ms)
    await delay(700);
  }

  // 4. Save Final Database
  saveFinalDB(enrichedItems);
  console.log('=== SCRAPING & ENRICHMENT COMPLETE ===');
}

run();
