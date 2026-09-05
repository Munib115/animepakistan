const fs = require('fs');

const html = fs.readFileSync('scratch_dmc.html', 'utf8');
const regex = /action:\s*['"]([^'"]+)['"]/g;
let m;
while ((m = regex.exec(html)) !== null) {
  console.log('Action found:', m[1]);
}

// Check torofilm JS files
const scriptMatches = html.match(/src=['"]([^'"]+torofilm[^'"]+)['"]/g);
console.log('Torofilm scripts:', scriptMatches);
