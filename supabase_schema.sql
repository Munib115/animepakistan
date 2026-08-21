-- ==============================================================================
-- ANIME PAKISTAN (AP) - EPISODE COMMENTS & VOICE AUDIO NOTES SCHEMA
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

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.episode_comments ENABLE ROW LEVEL SECURITY;

-- 4. Allow anyone (guests & users) to read comments
CREATE POLICY "Allow public read access to episode comments"
ON public.episode_comments FOR SELECT
USING (true);

-- 5. Allow anyone to post comments & voice notes
CREATE POLICY "Allow public insert to episode comments"
ON public.episode_comments FOR INSERT
WITH CHECK (true);

-- 6. Allow anyone to like comments
CREATE POLICY "Allow public update likes on episode comments"
ON public.episode_comments FOR UPDATE
USING (true)
WITH CHECK (true);

-- 7. Create public storage bucket for Voice Audio recordings
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comment_audio', 'comment_audio', true)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage RLS policies for voice audio bucket
CREATE POLICY "Allow public read audio files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'comment_audio');

CREATE POLICY "Allow public upload audio files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'comment_audio');
