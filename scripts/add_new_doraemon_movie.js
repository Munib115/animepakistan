const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');

const newMovie = {
  id: 'ap-doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil',
  title: 'Doraemon the Movie: New Nobita and the Castle of the Undersea Devil',
  slug: 'doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil',
  saltSlug: 'doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil',
  type: 'movie',
  poster: 'https://image.tmdb.org/t/p/original/gdllrWFb9ffvGkCDQAflrdnTaAg.jpg',
  backdrop: 'https://image.tmdb.org/t/p/original/pxd9rc03EMMln3tVFdfd427Fpsi.jpg',
  description: "Nobita and friends find a secret underwater castle packed with mysteries and riches. With Doraemon's high-tech gadgets, they dive into an ocean adventure mixing humor, teamwork, and imagination in a breathtaking aquatic world.",
  genres: ['Animation', 'Adventure', 'Family', 'Fantasy', 'Sci-Fi'],
  audioLanguages: ['Hindi', 'Urdu', 'Japanese'],
  rating: 8.9,
  year: 2026,
  episodes: [
    {
      number: 1,
      season: 1,
      title: 'Full Movie (1080p Full HD)',
      slug: 'doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil-movie',
      url: 'https://www.terabox.app/sharing/embed?surl=sxJCF-XP7RYBR4DU_sYgwA',
      thumbnail: 'https://image.tmdb.org/t/p/original/pxd9rc03EMMln3tVFdfd427Fpsi.jpg',
      streamUrl: 'https://www.terabox.app/sharing/embed?surl=sxJCF-XP7RYBR4DU_sYgwA',
      streamSources: [
        {
          label: 'TeraBox Cloud (Full HD)',
          url: 'https://www.terabox.app/sharing/embed?surl=sxJCF-XP7RYBR4DU_sYgwA',
          isMultiAudio: true
        },
        {
          label: 'Direct Full HD (Local Server)',
          url: '/videos/doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4',
          isMultiAudio: true
        }
      ]
    }
  ],
  episodeCount: 1,
  episodesCount: 1,
  streamUrl: 'https://www.terabox.app/sharing/embed?surl=sxJCF-XP7RYBR4DU_sYgwA',
  streamSources: [
    {
      label: 'TeraBox Cloud (Full HD)',
      url: 'https://www.terabox.app/sharing/embed?surl=sxJCF-XP7RYBR4DU_sYgwA',
      isMultiAudio: true
    },
    {
      label: 'Direct Full HD (Local Server)',
      url: '/videos/doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4',
      isMultiAudio: true
    }
  ],
  anilist: {
    id: 1542261,
    englishName: 'Doraemon the Movie: New Nobita and the Castle of the Undersea Devil',
    romajiName: 'Eiga Doraemon: Shin Nobita no Kaitei Kiganjō',
    nativeName: '映画ドラえもん 新・のび太の海底鬼岩城',
    description: "Nobita and friends find a secret underwater castle packed with mysteries and riches. With Doraemon's high-tech gadgets, they dive into an ocean adventure mixing humor, teamwork, and imagination in a breathtaking aquatic world.",
    coverImage: 'https://image.tmdb.org/t/p/original/gdllrWFb9ffvGkCDQAflrdnTaAg.jpg',
    bannerImage: 'https://image.tmdb.org/t/p/original/pxd9rc03EMMln3tVFdfd427Fpsi.jpg',
    rating: 89,
    year: 2026,
    genres: ['Animation', 'Adventure', 'Family', 'Fantasy', 'Sci-Fi']
  },
  source: 'local',
  isCustomLocal: true,
  isFeaturedHero: true
};

function main() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  // Remove any existing entry with this slug
  const filteredDb = db.filter(d => d.slug !== newMovie.slug);

  // Unshift to the very top of DB!
  filteredDb.unshift(newMovie);

  fs.writeFileSync(DB_PATH, JSON.stringify(filteredDb, null, 2), 'utf8');
  console.log(`Saved ${filteredDb.length} items to ${DB_PATH} (Doraemon Undersea Devil placed at index 0)`);

  // Regenerate catalog
  const catalog = filteredDb.map(item => ({
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
    hasStreams: true,
    anilist: item.anilist || undefined,
    source: item.source || 'animesalt',
    isCustomLocal: item.isCustomLocal || false,
    isFeaturedHero: item.isFeaturedHero || false
  }));

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved ${catalog.length} items to ${CATALOG_PATH}`);
}

main();
