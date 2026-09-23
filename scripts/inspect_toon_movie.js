const cheerio = require('cheerio');

async function test() {
  const res = await fetch('https://toonstream.us/movies/spirited-away/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  console.log('HTML length:', html.length);
  const $ = cheerio.load(html);
  console.log('iframes:', $('iframe').map((_, el) => $(el).attr('src')).get());
  
  // Check for servers / options
  $('.playex, [data-player], [data-embed], .server-item, .opt-item, .dooplay_player_option').each((_, el) => {
    console.log('Server elem:', {
      text: $(el).text().trim(),
      dataPost: $(el).attr('data-post'),
      dataNume: $(el).attr('data-nume'),
      dataType: $(el).attr('data-type'),
      dataPlayer: $(el).attr('data-player'),
      dataEmbed: $(el).attr('data-embed'),
      dataSrc: $(el).attr('data-src'),
      href: $(el).attr('href'),
    });
  });
}
test();
