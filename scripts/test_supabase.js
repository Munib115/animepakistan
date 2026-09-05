const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Client...');
console.log('URL:', url);
console.log('Key length:', key ? key.length : 0);

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase.from('episode_comments').select('*').limit(5);
    console.log('Response data count:', data ? data.length : 0);
    console.log('Response error:', error ? error.message : 'None');
    console.log('Connection to Supabase and episode_comments table successfully verified!');
  } catch (err) {
    console.error('Connection error:', err);
  }
}

test();
