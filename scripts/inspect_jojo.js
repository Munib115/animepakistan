const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('scratch_jojo.html', 'utf8');
const $ = cheerio.load(html);

console.log('Title:', $('title').text());
console.log('H1:', $('h1').text().trim());
console.log('Poster:', $('img.poster, .poster img, .cover img, [class*="poster"]').first().attr('src'));

const episodes = [];
$('a[href*="/episode/"]').each((i, el) => {
  episodes.push({
    href: $(el).attr('href'),
    text: $(el).text().trim(),
    title: $(el).attr('title')
  });
});
console.log(`Found ${episodes.length} episodes for JoJo:`);
console.log(episodes.slice(0, 5));
