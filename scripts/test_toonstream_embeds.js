async function testEmbeds() {
  const ids = [
    'af810f7467ed1ad0',
    'd08d0af2f9a8208d',
    'e1b17eee43e8a3fc',
    'c9bf46f76bb3ee67',
    '401477d839b6ae2e'
  ];
  for (const id of ids) {
    try {
      const res = await fetch(`https://toon-stream.site/embed/${id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://toon-stream.site/episode/jojos-bizarre-adventure-1x1/'
        }
      });
      const html = await res.text();
      const match = html.match(/src="([^"]+)"/i);
      console.log(id, match ? match[1] : 'None');
    } catch (e) {
      console.log(id, 'ERR:', e.message);
    }
  }
}
testEmbeds();
