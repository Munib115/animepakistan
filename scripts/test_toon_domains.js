async function check() {
  const domains = [
    'https://toon-stream.site/',
    'https://toonstream.co/',
    'https://toonstream.net/',
    'https://toonstream.in/',
    'https://toon-stream.net/'
  ];
  for (const d of domains) {
    try {
      const res = await fetch(d, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(6000)
      });
      console.log(d, res.status);
    } catch (e) {
      console.log(d, e.message);
    }
  }
}
check();
