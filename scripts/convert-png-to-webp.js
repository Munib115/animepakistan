/**
 * convert-png-to-webp.js
 * Converts all PNG images in /public to WebP using sharp.
 * Keeps the originals (renamed to .png.bak) so nothing breaks.
 * Also converts src/app icon PNGs.
 * Run: node scripts/convert-png-to-webp.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const TARGET_DIRS = [
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, '..', 'src', 'app'),
];

// Icons used by browsers/PWA manifests MUST stay PNG — only convert page-used images
// But for this project all PNGs are icons/logos, so we convert with quality 90
// and keep the originals for manifest references
const QUALITY = 90;

async function findPNGs(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await findPNGs(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function convertPNG(filePath) {
  const webpPath = filePath.replace(/\.png$/i, '.webp');
  const originalSize = fs.statSync(filePath).size;

  try {
    await sharp(filePath)
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(webpPath);

    const newSize = fs.statSync(webpPath).size;
    const saving = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    const rel = path.relative(process.cwd(), filePath);

    console.log(
      `  ✅ ${rel}`.padEnd(70) +
      `${(originalSize/1024).toFixed(1)} KB → ${(newSize/1024).toFixed(1)} KB  (${saving}% smaller)`
    );
    return { filePath, webpPath, originalSize, newSize };
  } catch (err) {
    console.error(`  ❌ FAILED: ${filePath}`, err.message);
    return null;
  }
}

async function main() {
  console.log('\n🔄  Converting PNG → WebP\n');

  let allPNGs = [];
  for (const dir of TARGET_DIRS) {
    allPNGs.push(...await findPNGs(dir));
  }

  // Skip already-converted or backup files
  allPNGs = allPNGs.filter(f => !f.endsWith('.bak'));

  if (allPNGs.length === 0) {
    console.log('No PNG files found.');
    return;
  }

  console.log(`Found ${allPNGs.length} PNG file(s):\n`);

  let totalOriginal = 0;
  let totalNew = 0;

  for (const pngPath of allPNGs) {
    const result = await convertPNG(pngPath);
    if (result) {
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
    }
  }

  const totalSaving = ((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1);
  console.log('\n─────────────────────────────────────────────────────────');
  console.log(`📦  Total: ${(totalOriginal/1024).toFixed(1)} KB → ${(totalNew/1024).toFixed(1)} KB`);
  console.log(`🚀  Overall saving: ${totalSaving}%`);
  console.log('\n✔  Done! WebP files created alongside originals.');
  console.log('   Update any hardcoded .png references to .webp where needed.\n');
}

main().catch(console.error);
