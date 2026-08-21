const { checkAndSyncNewAnime } = require('../src/lib/sync.ts');

async function testSync() {
  console.log('Testing anime catalog sync engine...');
  const res = await checkAndSyncNewAnime(true);
  console.log('Sync result:', res);
}

testSync().catch(console.error);
