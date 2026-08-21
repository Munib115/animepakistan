const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
let items = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Filter out invalid items and clean branding
items = items.filter(item => {
  if (!item.slug || item.slug === 'movies' || item.slug === 'series') return false;
  if (!item.title || item.title.toLowerCase() === 'movies' || item.title.toLowerCase() === 'series') return false;
  return true;
});

// Clean branding in titles, posters, and episode lists
items = items.map(item => {
  // Clean poster
  if (item.poster && item.poster.includes('AnimeSaltLong.png')) {
    item.poster = '';
  }
  
  // Clean titles
  let title = item.title
    .replace(/AnimeSalt/gi, '')
    .replace(/Private:\s*/gi, '')
    .replace(/\[\s*Dual\s*Audio\s*\]/gi, '')
    .replace(/\[\s*Multi\s*Audio\s*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  item.title = title;

  // Clean episodes
  if (item.episodes && Array.isArray(item.episodes)) {
    item.episodes = item.episodes.map(ep => {
      let epTitle = ep.title
        .replace(/AnimeSalt/gi, '')
        .replace(/Private:\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      let epThumb = ep.thumbnail;
      if (epThumb && epThumb.includes('AnimeSaltLong.png')) {
        epThumb = '';
      }
      return {
        ...ep,
        title: epTitle,
        thumbnail: epThumb
      };
    });
  }

  return item;
});

fs.writeFileSync(dbPath, JSON.stringify(items, null, 2), 'utf8');
console.log(`Database sanitized: ${items.length} clean anime items ready.`);
