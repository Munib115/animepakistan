const fs = require('fs');
const path = require('path');

const ARTIFACT_LOGO = path.join('C:', 'Users', 'Munib Raza', '.gemini', 'antigravity-ide', 'brain', '755b31db-a529-4978-b07c-79bd1e3954ac', 'anime_pakistan_ap_logo_1787336347972.jpg');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const APP_DIR = path.join(__dirname, '..', 'src', 'app');

console.log('Artifact logo path exists:', fs.existsSync(ARTIFACT_LOGO));

if (fs.existsSync(ARTIFACT_LOGO)) {
  const logoBuf = fs.readFileSync(ARTIFACT_LOGO);

  // Copy to public logo assets
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.png'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.webp'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192x192.png'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512x512.png'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), logoBuf);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), logoBuf);

  // Copy to Next.js App Router root assets so Next.js serves them with 0 cache conflicts
  fs.writeFileSync(path.join(APP_DIR, 'favicon.ico'), logoBuf);
  fs.writeFileSync(path.join(APP_DIR, 'icon.png'), logoBuf);
  fs.writeFileSync(path.join(APP_DIR, 'apple-icon.png'), logoBuf);

  console.log('Successfully updated all public/ and src/app/ icons with the new AP Logo!');
} else {
  console.error('Artifact logo not found at path');
}
