const fs = require('fs');
const path = require('path');

async function downloadFile(url, destPath) {
  console.log(`Downloading ${url} -> ${destPath}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`Successfully downloaded! Size: ${fs.statSync(destPath).size} bytes`);
}

async function run() {
  const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
    console.log(`Created directory: ${fontsDir}`);
  }

  // Inter Variable Font (WOFF2) from official rsms/inter GitHub repository
  const interUrl = 'https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/InterVariable.woff2';
  const interDest = path.join(fontsDir, 'InterVariable.woff2');

  // Material Symbols Outlined Variable Font (WOFF2) from official google/material-design-icons GitHub repository
  const materialSymbolsUrl = 'https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.woff2';
  const materialSymbolsDest = path.join(fontsDir, 'MaterialSymbolsOutlined.woff2');

  try {
    await downloadFile(interUrl, interDest);
    await downloadFile(materialSymbolsUrl, materialSymbolsDest);
    console.log('All fonts downloaded successfully!');
  } catch (err) {
    console.error('Error downloading fonts:', err);
    process.exit(1);
  }
}

run();
