const { resolveStreamSources } = require('../src/lib/resolver.ts');

async function test() {
  const urls = [
    'https://animesalt.link/episode/naruto-shippuden-1x1/',
    'https://animesalt.link/episode/death-note-1x1/',
    'https://animesalt.link/movies/chainsaw-man-the-movie-reze-arc/',
    'https://animesalt.link/movies/shinchan-movie-the-spicy-kasukabe-dancers/',
    'https://animesalt.link/episode/cells-at-work-1x1/'
  ];

  for (const u of urls) {
    console.log('\nTesting URL:', u);
    const sources = await resolveStreamSources(u);
    console.log('Resolved sources:', sources);
  }
}

test().catch(console.error);
