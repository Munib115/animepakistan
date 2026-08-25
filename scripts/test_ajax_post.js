async function testAjaxPost() {
  const hash = '49182f81e6a13cf5eaa496d51fea6406';
  const url = `https://as-cdn26.top/player/index.php?data=${hash}&do=getVideo`;
  const referer = 'https://animesalt.cx/';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': referer,
        'Origin': 'https://as-cdn26.top',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: `hash=${hash}&r=${encodeURIComponent(referer)}`
    });

    console.log('Status:', res.status);
    const responseText = await res.text();
    console.log('Response content:');
    console.log(responseText);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
testAjaxPost();
