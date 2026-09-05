import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wrmewhpsbngwtokgggif.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndybWV3aHBzYm5nd3Rva2dnZ2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzM5MjYsImV4cCI6MjEwMjkwOTkyNn0.mdg-9VsPlhURfl_SKO7ym26OjcPdWy25livYq2WthwA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
