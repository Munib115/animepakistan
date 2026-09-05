const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'anime-db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Exact configuration for all 13 Ben 10 items from animesalt.cx
const ben10Config = {
  // 8 Movies
  'ben-10-secret-of-the-omnitrix': {
    saltSlug: 'ben-10-secret-of-the-omnitrix',
    url: 'https://animesalt.cx/movies/ben-10-secret-of-the-omnitrix/',
    streamUrl: 'https://animesalt.cx/multi-lang-plyr/player.php?data=W3sibGFuZ3VhZ2UiOiJIaW5kaSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9yMWE4cko4TDYifSx7Imxhbmd1YWdlIjoiRW5nbGlzaCIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC8xaEFxZHhFaXoifV0%3D',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/vPND6Qff1KVYAtjaQuZtij8wtAj.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/rLDD8pzbACRNIRHTrUqIrUU9Xyk.jpg',
  },
  'ben-10-race-against-time': {
    saltSlug: 'ben-10-race-against-time',
    url: 'https://animesalt.cx/movies/ben-10-race-against-time/',
    streamUrl: 'https://animesalt.cx/multi-lang-plyr/player.php?data=W3sibGFuZ3VhZ2UiOiJIaW5kaSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9YSGJsUnpZYmgifSx7Imxhbmd1YWdlIjoiRW5nbGlzaCIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9odWxZT0w4bzgifV0%3D',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/fXGAMKFtm74TICGaSTCLGTvyBk4.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/mS7fLg1Yz7qPHFkwOds58LZAICG.jpg',
  },
  'ben-10-destroy-all-aliens': {
    saltSlug: 'ben-10-destroy-all-aliens',
    url: 'https://animesalt.cx/movies/ben-10-destroy-all-aliens/',
    streamUrl: 'https://animesalt.cx/multi-lang-plyr/player.php?data=W3sibGFuZ3VhZ2UiOiJIaW5kaSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC8tdVdUM2FIWk8ifSx7Imxhbmd1YWdlIjoiRW5nbGlzaCIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC8yQXVxSTBUVVcifV0%3D',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/qoILNllyC6YXHyT4V9YOhMJlPuO.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/eB1l1IDP1oYmfopTTZIADduLuDg.jpg',
  },
  'ben-10-alien-swarm': {
    saltSlug: 'ben-10-alien-swarm',
    url: 'https://animesalt.cx/movies/ben-10-alien-swarm/',
    streamUrl: 'https://animesalt.cx/multi-lang-plyr/player.php?data=W3sibGFuZ3VhZ2UiOiJIaW5kaSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9EdGhkTF9KV1YifSx7Imxhbmd1YWdlIjoiRW5nbGlzaCIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9qeDJKcGhndWUifV0%3D',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/wROzAzrcSsRTu1fQQu2QdaUER2X.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/oK190JudMVb0C5773Vab0TKcBbv.jpg',
  },
  'ben-10-generator-rex-heroes-united': {
    saltSlug: 'ben-10-generator-rex-heroes-united',
    url: 'https://animesalt.cx/movies/ben-10-generator-rex-heroes-united/',
    streamUrl: 'https://as-cdn26.top/video/12ac72f445ced20780a7900df364608a',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/mRMkd4e4oowrUyFC2kF9eQsFCDr.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/iuGC33vao0IhnZtAqxmGLW5XMCa.jpg',
  },
  'ben-10-vs-the-universe-the-movie': {
    saltSlug: 'ben-10-vs-the-universe-the-movie',
    url: 'https://animesalt.cx/movies/ben-10-vs-the-universe-the-movie/',
    streamUrl: 'https://animesalt.cx/multi-lang-plyr/player.php?data=W3sibGFuZ3VhZ2UiOiJIaW5kaSIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9YaGNXRGdZcVcifSx7Imxhbmd1YWdlIjoiRW5nbGlzaCIsImxpbmsiOiJodHRwczpcL1wvc2hvcnQuaWN1XC9LdEZPdlQ3QUMifV0%3D',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/34KSOJVowmkeh6G0HZJMxqdHq6s.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/w9vIb69U3rCNrpktTL8a89Meomf.jpg',
  },
  'ben-10-alien-x-tinction': {
    saltSlug: 'ben-10-alien-x-tinction',
    url: 'https://animesalt.cx/movies/ben-10-alien-x-tinction/',
    streamUrl: 'https://as-cdn26.top/video/cb955adc83940992b9fdc8e5eabc9b80',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/pgL3pJEPv1K4Bb1isw5PFlA1MJ3.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/gG8At6y4p89KJsKYx1kYZIBdOz4.jpg',
  },
  'ben-10010': {
    saltSlug: 'ben-10010',
    url: 'https://animesalt.cx/movies/ben-10010/',
    streamUrl: 'https://as-cdn26.top/video/6974909f63282da92162267b49df3b34',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/6aDh4yH5FHaMfjdsqw4n97rl7FJ.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/4h42eQj0i65VIkMeM1XzPPXSWcC.jpg',
  },

  // 5 Series
  'ben-10': {
    saltSlug: 'ben-10',
    url: 'https://animesalt.cx/series/ben-10/',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/eogRp6oAPK0SEvQmCrQ78LTlSdp.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/2TLURbcJ8fzkP2OhFTnDIPMaeZr.jpg',
  },
  'ben-10-alien-force': {
    saltSlug: 'ben-10-alien-force',
    url: 'https://animesalt.cx/series/ben-10-alien-force/',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/sEocAE3h5iu8CUNhdx1gHan7QJf.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/dE28FZ6HKbsM8cJxlYk4WL0vuhU.jpg',
  },
  'ben-10-ultimate-alien': {
    saltSlug: 'ben-10-ultimate-alien',
    url: 'https://animesalt.cx/series/ben-10-ultimate-alien/',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/4mk8iFUbTyUtjeYZDU5zgPm2o1s.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/oGEF6kQLGsreSrUtcKg4F2p1Bqz.jpg',
  },
  'ben-10-omniverse': {
    saltSlug: 'ben-10-omniverse',
    url: 'https://animesalt.cx/series/ben-10-omniverse/',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/Re9I5tauOspaJxYCIqRqavKT4F.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/jm3VtQRbxLysEEYcUSwuj67LvXS.jpg',
  },
  'ben-10-reboot': {
    saltSlug: 'ben-10-reboot',
    url: 'https://animesalt.cx/series/ben-10-reboot/',
    audioLanguages: ['Hindi', 'English'],
    poster: 'https://image.tmdb.org/t/p/w500/gd0rHCpaj755YFdTLD8Quhmu1TO.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/k3jqkKB6gDXNDLYyfTLskCwxw6M.jpg',
  },
};

let updatedCount = 0;

for (let i = 0; i < db.length; i++) {
  const item = db[i];
  const cfg = ben10Config[item.slug];
  if (cfg) {
    db[i] = {
      ...item,
      saltSlug: cfg.saltSlug,
      url: cfg.url,
      ...(cfg.streamUrl ? { streamUrl: cfg.streamUrl } : {}),
      poster: cfg.poster,
      backdrop: cfg.backdrop,
      audioLanguages: cfg.audioLanguages,
      genres: Array.from(new Set([...(item.genres || []), 'Action', 'Adventure', 'Sci-Fi', 'Cartoon', 'Superpower'])),
    };
    updatedCount++;
    console.log(`Updated [${item.type.toUpperCase()}] ${item.title} (slug: ${item.slug}, saltSlug: ${cfg.saltSlug})`);
  }
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
console.log(`\nSuccessfully updated ${updatedCount} Ben 10 items in anime-db.json!`);
