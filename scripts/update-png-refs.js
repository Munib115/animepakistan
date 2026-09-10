/**
 * update-png-refs.js
 * Replaces /logo.png and /icon-512.png references with .webp equivalents
 * in tsx/ts source files. Keeps manifest.json and apple-touch-icon as PNG.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/app/layout.tsx',
  'src/components/Header.tsx',
  'src/components/Footer.tsx',
  'src/components/PWAInstallBanner.tsx',
];

let totalChanged = 0;

for (const rel of files) {
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found):', rel);
    continue;
  }
  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;

  // Replace /logo.png (with optional query string like ?v=ap5) → /logo.webp
  src = src.replace(/\/logo\.png(\?[^'">\s]*)?/g, '/logo.webp');

  // Replace /icon-512.png → /icon-512.webp  (used in OG/Twitter metadata)
  src = src.replace(/\/icon-512\.png/g, '/icon-512.webp');

  if (src !== original) {
    fs.writeFileSync(filePath, src, 'utf8');
    console.log('✅ Updated:', rel);
    totalChanged++;
  } else {
    console.log('—  No changes:', rel);
  }
}

console.log('\nDone.', totalChanged, 'file(s) updated.');
