async function testLinks() {
  const data = "W3sibGFuZ3VhZ2UiOiJIaW5kaSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC92b1ZOU25TV00ifSx7Imxhbmd1YWdlIjoiVGFtaWwiLCJsaW5rIjoiaHR0cHM6XC9cL3Nob3J0LmljdVwvVDVuRmJ6NUtaIn0seyJsYW5ndWFnZSI6IlRlbHVndSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC8xam1yWGZ0Y0YifSx7Imxhbmd1YWdlIjoiRW5nbGlzaCIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9DMURwa1Y2MFUifSx7Imxhbmd1YWdlIjoiSmFwYW5lc2UiLCJsaW5rIjoiaHR0cHM6XC9cL3Nob3J0LmljdVwvYzI5dGtrMGVwIn1d";
  const playerUrl = `https://animesalt.link/multi-lang-plyr/player.php?data=${data}`;
  
  console.log('Testing playerUrl:', playerUrl);
  const pRes = await fetch(playerUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://animesalt.link/' }
  });
  console.log('Player status:', pRes.status, 'headers:', Object.fromEntries(pRes.headers.entries()));
  const pText = await pRes.text();
  console.log('Player HTML preview:', pText.slice(0, 1000));

  const shortUrl = 'https://short.icu/voVNSnSWM';
  console.log('\nTesting shortUrl:', shortUrl);
  const sRes = await fetch(shortUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Referer': 'https://animesalt.link/' },
    redirect: 'manual'
  });
  console.log('Short status:', sRes.status, 'headers:', Object.fromEntries(sRes.headers.entries()));
  if (sRes.headers.get('location')) {
    console.log('Redirect location:', sRes.headers.get('location'));
  }
}

testLinks().catch(console.error);
