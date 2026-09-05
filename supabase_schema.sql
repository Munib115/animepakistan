-- ==============================================================================
-- ANIME PAKISTAN (AP) - COMPLETE SUPABASE SCHEMA
-- (Episode Comments, Voice Notes, and Shared Libraries by Code)
-- Paste this entire SQL into your Supabase Dashboard -> SQL Editor and click RUN
-- ==============================================================================

-- 1. Create episode_comments table
CREATE TABLE IF NOT EXISTS public.episode_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anime_slug TEXT NOT NULL,
    episode_slug TEXT NOT NULL,
    guest_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    avatar_seed TEXT DEFAULT 'ninja',
    content TEXT,
    audio_url TEXT,
    audio_duration INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create index for ultra-fast query lookups by anime and episode
CREATE INDEX IF NOT EXISTS idx_comments_anime_episode 
ON public.episode_comments(anime_slug, episode_slug, created_at DESC);

-- 3. Enable Row Level Security (RLS) for episode comments
ALTER TABLE public.episode_comments ENABLE ROW LEVEL SECURITY;

-- 4. Allow anyone (guests & users) to read comments
DROP POLICY IF EXISTS "Allow public read access to episode comments" ON public.episode_comments;
CREATE POLICY "Allow public read access to episode comments"
ON public.episode_comments FOR SELECT
USING (true);

-- 5. Allow anyone to post comments & voice notes
DROP POLICY IF EXISTS "Allow public insert to episode comments" ON public.episode_comments;
CREATE POLICY "Allow public insert to episode comments"
ON public.episode_comments FOR INSERT
WITH CHECK (true);

-- 6. Allow anyone to like comments
DROP POLICY IF EXISTS "Allow public update likes on episode comments" ON public.episode_comments;
CREATE POLICY "Allow public update likes on episode comments"
ON public.episode_comments FOR UPDATE
USING (true)
WITH CHECK (true);

-- 7. Enable Realtime for episode comments so new comments appear live
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'episode_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.episode_comments;
  END IF;
END $$;

-- 8. Create public storage bucket for Voice Audio recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comment_audio', 'comment_audio', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage RLS policies for voice audio bucket
DROP POLICY IF EXISTS "Allow public read audio files" ON storage.objects;
CREATE POLICY "Allow public read audio files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'comment_audio');

DROP POLICY IF EXISTS "Allow public upload audio files" ON storage.objects;
CREATE POLICY "Allow public upload audio files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'comment_audio');

-- ==============================================================================
-- 10. SHARED LIBRARIES TABLE (Share anime library via 6-digit Code)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shared_libraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_code TEXT UNIQUE NOT NULL,
    creator_id TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    watchlist JSONB DEFAULT '[]'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '30 days')
);

-- Fast lookup by share code
CREATE INDEX IF NOT EXISTS idx_shared_libraries_code 
ON public.shared_libraries(share_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shared_libraries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read shared libraries by entering code
DROP POLICY IF EXISTS "Allow public read shared libraries" ON public.shared_libraries;
CREATE POLICY "Allow public read shared libraries"
ON public.shared_libraries FOR SELECT
USING (true);

-- Allow anyone to publish/create a shared library
DROP POLICY IF EXISTS "Allow public create shared libraries" ON public.shared_libraries;
CREATE POLICY "Allow public create shared libraries"
ON public.shared_libraries FOR INSERT
WITH CHECK (true);

-- Allow creator or anyone with code to update their shared library snapshot
DROP POLICY IF EXISTS "Allow public update own shared libraries" ON public.shared_libraries;
CREATE POLICY "Allow public update own shared libraries"
ON public.shared_libraries FOR UPDATE
USING (true)
WITH CHECK (true);
