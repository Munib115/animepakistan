const fs = require('fs');
const path = require('path');
const https = require('https');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');

function fetchUrl(url, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://animesalt.link/',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function parseEpisodesFromHtml(html, seasonNum = 1) {
  const episodes = [];
  // Match <article class="... episodes ..."> ... <span class="num-epi">(\d+)</span> ... <h2 class="entry-title">(.*?)</h2> ... <a href="(.*?)"
  const articles = [...html.matchAll(/<article[^>]*class="[^"]*episodes[^"]*"[^>]*>([\s\S]*?)<\/article>/gi)];

  if (articles.length > 0) {
    for (const art of articles) {
      const artHtml = art[1];
      const numMatch = artHtml.match(/<span[^>]*class="num-epi"[^>]*>(\d+)<\/span>/i);
      const titleMatch = artHtml.match(/<h2[^>]*class="entry-title"[^>]*>(.*?)<\/h2>/i);
      const linkMatch = artHtml.match(/<a[^>]*href="([^"]*\/episode\/[^"]*)"[^>]*>/i);
      const thumbMatch = artHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i);

      const epNum = numMatch ? parseInt(numMatch[1], 10) : episodes.length + 1;
      const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : `Episode ${epNum}`;
      const epUrl = linkMatch ? linkMatch[1] : '';
      const thumb = thumbMatch ? thumbMatch[1] : '';

      if (epUrl) {
        const slug = epUrl.replace(/\/$/, '').split('/').pop() || `ep-${seasonNum}-${epNum}`;
        episodes.push({
          number: epNum,
          season: seasonNum,
          title: `S${seasonNum} E${epNum}: ${rawTitle}`,
          slug: slug,
          url: epUrl,
          thumbnail: thumb,
        });
      }
    }
  } else {
    // Fallback: match all /episode/ links
    const linkMatches = [...html.matchAll(/<a[^>]*href="([^"]*\/episode\/([^"\/]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const seen = new Set();
    for (const lm of linkMatches) {
      const epUrl = lm[1];
      const epSlug = lm[2];
      if (!seen.has(epUrl)) {
        seen.add(epUrl);
        episodes.push({
          number: episodes.length + 1,
          season: seasonNum,
          title: `S${seasonNum} Episode ${episodes.length + 1}`,
          slug: epSlug,
          url: epUrl,
          thumbnail: '',
        });
      }
    }
  }

  return episodes;
}

async function scrapeAllSeasons() {
  console.log('=== STARTING FULL MULTI-SEASON & DORAEMON SCRAPING ===\n');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  console.log(`Loaded ${db.length} existing items from database.`);

  const seriesItems = db.filter(i => i.type === 'series');
  console.log(`Found ${seriesItems.length} series to audit for multiple seasons.`);

  let updatedSeriesCount = 0;
  let totalNewEpisodes = 0;

  for (let i = 0; i < seriesItems.length; i++) {
    const item = seriesItems[i];
    const seriesUrl = item.url;
    if (!seriesUrl || !seriesUrl.includes('animesalt.link')) continue;

    try {
      const html = await fetchUrl(seriesUrl);

      // Find all season buttons
      const seasonButtons = [...html.matchAll(/<a[^>]*class="[^"]*season-btn[^"]*"[^>]*data-post="(\d+)"[^>]*data-season="(\d+)"[^>]*>/gi)];

      if (seasonButtons.length > 0) {
        const postId = seasonButtons[0][1];
        const allEpisodes = [];

        for (const btn of seasonButtons) {
          const sNum = parseInt(btn[2], 10);
          try {
            // Fetch via admin-ajax.php
            const ajaxUrl = `https://animesalt.link/wp-admin/admin-ajax.php?action=action_select_season&season=${sNum}&post=${postId}`;
            const ajaxHtml = await fetchUrl(ajaxUrl);
            const sEpisodes = parseEpisodesFromHtml(ajaxHtml, sNum);
            allEpisodes.push(...sEpisodes);
          } catch (err) {
            console.error(`  [!] Failed to fetch Season ${sNum} for "${item.title}":`, err.message);
          }
        }

        if (allEpisodes.length > 0) {
          const prevCount = item.episodes?.length || 0;
          if (allEpisodes.length > prevCount) {
            console.log(`[${i + 1}/${seriesItems.length}] "${item.title}": Updated from ${prevCount} to ${allEpisodes.length} episodes across ${seasonButtons.length} seasons!`);
            item.episodes = allEpisodes;
            updatedSeriesCount++;
            totalNewEpisodes += (allEpisodes.length - prevCount);
          }
        }
      }
    } catch (e) {
      // Ignore individual failures
    }

    // Save incrementally every 20 series
    if ((i + 1) % 20 === 0) {
      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
      console.log(`--- Checkpoint saved at ${i + 1}/${seriesItems.length} ---`);
    }
  }

  // Save final state
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`\n=== MULTI-SEASON SCRAPING COMPLETE: Updated ${updatedSeriesCount} series with ${totalNewEpisodes} newly discovered episodes! ===\n`);
}

scrapeAllSeasons().catch(console.error);
