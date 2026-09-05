async function inspectRuby() {
  try {
    const res = await fetch('https://rubystm.com/vw2vjy6g4s40.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://toon-stream.site/'
      }
    });
    const html = await res.text();
    require('fs').writeFileSync('scratch_ruby.html', html);
    console.log('Saved scratch_ruby.html, length:', html.length);
    const m = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/i);
    console.log('Direct m3u8 match:', m ? m[0] : 'None');
  } catch (e) {
    console.error('Error:', e.message);
  }
}
inspectRuby();
