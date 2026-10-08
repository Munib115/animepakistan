/**
 * Script to upload Doraemon Undersea Devil movie to Supabase Storage
 * Usage:
 *   node scripts/upload_movie_to_supabase.js
 * 
 * Optional environment variables:
 *   SUPABASE_URL (default: project URL from supabase.ts)
 *   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
 *   SUPABASE_BUCKET (default: movies)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wrmewhpsbngwtokgggif.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndybWV3aHBzYm5nd3Rva2dnZ2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzM5MjYsImV4cCI6MjEwMjkwOTkyNn0.mdg-9VsPlhURfl_SKO7ym26OjcPdWy25livYq2WthwA';

const BUCKET_NAME = process.env.SUPABASE_BUCKET || 'movies';
const DEST_FILE_NAME = 'doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4';

const candidatePaths = [
  path.join(__dirname, '../public/videos/doraemon-nobita-and-the-castle-of-the-undersea-devil.mp4'),
  path.join(__dirname, '../Doraemon New Nobita and the Castle of the Undersea Devil !.mp4'),
];

let localFilePath = candidatePaths.find(p => fs.existsSync(p));

if (!localFilePath) {
  console.error('❌ Error: Could not locate movie MP4 file in project directory.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const stat = fs.statSync(localFilePath);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`🎬 Found movie file: ${localFilePath} (${sizeMB} MB)`);
  console.log(`🚀 Uploading to Supabase bucket "${BUCKET_NAME}" as "${DEST_FILE_NAME}"...`);

  const fileStream = fs.createReadStream(localFilePath);

  // Upload using supabase storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(DEST_FILE_NAME, fileStream, {
      contentType: 'video/mp4',
      upsert: true,
      duplex: 'half',
    });

  if (error) {
    console.error('❌ Supabase Upload Error:', error.message);
    console.log('\n💡 Tip: If the bucket does not exist:');
    console.log(`1. Go to your Supabase Dashboard: ${SUPABASE_URL.replace('.supabase.co', '')}`);
    console.log(`2. Navigate to Storage -> Create New Bucket -> Name it "${BUCKET_NAME}".`);
    console.log('3. Toggle "Public bucket" to ON and save.');
    console.log('4. Then re-run this script: node scripts/upload_movie_to_supabase.js\n');
    process.exit(1);
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(DEST_FILE_NAME);

  const publicUrl = publicUrlData.publicUrl;
  console.log('✅ Movie successfully uploaded to Supabase!');
  console.log('🔗 Public Stream URL:', publicUrl);

  // Automatically update anime-db.json and anime-catalog.json
  const DB_PATH = path.join(__dirname, '../src/data/anime-db.json');
  const CATALOG_PATH = path.join(__dirname, '../src/data/anime-catalog.json');

  if (fs.existsSync(DB_PATH)) {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const movie = db.find(x => x.slug === 'doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil');
    if (movie) {
      const supabaseSource = {
        label: 'Supabase Cloud (Full HD)',
        url: publicUrl,
        isMultiAudio: true,
      };

      // Add Supabase as top streaming source
      movie.streamSources = [
        supabaseSource,
        ...(movie.streamSources || []).filter(s => !s.url.includes('supabase.co'))
      ];
      movie.streamUrl = publicUrl;

      if (movie.episodes && movie.episodes.length > 0) {
        movie.episodes[0].streamSources = [
          supabaseSource,
          ...(movie.episodes[0].streamSources || []).filter(s => !s.url.includes('supabase.co'))
        ];
        movie.episodes[0].streamUrl = publicUrl;
      }

      fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
      console.log('📝 Updated anime-db.json with Supabase streaming source.');

      // Sync catalog
      const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      const catMovie = catalog.find(x => x.slug === 'doraemon-the-movie-new-nobita-and-the-castle-of-the-undersea-devil');
      if (catMovie) {
        catMovie.streamSources = movie.streamSources;
        catMovie.streamUrl = publicUrl;
        fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
        console.log('📝 Updated anime-catalog.json with Supabase streaming source.');
      }
    }
  }

  console.log('\n🎉 Finished! The movie is now connected to Supabase and ready to stream.');
}

main().catch(console.error);
